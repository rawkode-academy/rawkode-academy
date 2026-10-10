import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'
import { createCuid2 } from '../cuid2'

// EXPAND step of the revision grant rollout. The new Worker owns revision grants;
// production traffic cutover is coordinated separately from the fresh preview schema.
// src/pending-migrations/20261009_160000_review_revision_grants_enforce is the CONTRACT step.
// Grant times must be canonical Date.toISOString() values so string comparison orders
// them. A round trip through strftime rejects anything else (and NULL, through IS).
// D1 caps GLOB patterns at 50 bytes, so a digit-by-digit GLOB cannot be used.
const iso = (column: string) => `strftime('%Y-%m-%dT%H:%M:%fZ',${column}) IS ${column}`
const grantColumns = 'id,video_id,revision_id,user_id,can_approve,version,granted_by_id,granted_at,expires_at,revoked_at,revoked_by_id'
type CurrentGrantCandidate = { video_id: string; revision_id: string; user_id: string; can_approve: number; version: number }
type HistoricalGrantCandidate = { video_id: string; revision_id: string; user_id: string }
type GrantBackfillDB = Pick<MigrateUpArgs['db'], 'all' | 'run'>

export const revisionGrantSchema = [
  `CREATE TABLE review_revision_grants (id TEXT PRIMARY KEY NOT NULL, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, revision_id TEXT NOT NULL REFERENCES video_revisions(id) ON DELETE RESTRICT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, can_approve INTEGER NOT NULL CHECK(can_approve IN (0,1)), version INTEGER NOT NULL CHECK(version>0), granted_by_id TEXT REFERENCES users(id) ON DELETE RESTRICT, granted_at TEXT NOT NULL CHECK(${iso('granted_at')}), expires_at TEXT NOT NULL CHECK(${iso('expires_at')} AND expires_at>granted_at), revoked_at TEXT CHECK(revoked_at IS NULL OR ${iso('revoked_at')}), revoked_by_id TEXT REFERENCES users(id) ON DELETE RESTRICT, UNIQUE(revision_id,user_id))`,
  // Payload index names, so the generated snapshot matches. No composite index.
  `CREATE INDEX review_revision_grants_video_idx ON review_revision_grants(video_id)`,
  `CREATE INDEX review_revision_grants_revision_idx ON review_revision_grants(revision_id)`,
  `CREATE INDEX review_revision_grants_user_idx ON review_revision_grants(user_id)`,
  `CREATE INDEX review_revision_grants_granted_by_idx ON review_revision_grants(granted_by_id)`,
  `CREATE INDEX review_revision_grants_revoked_by_idx ON review_revision_grants(revoked_by_id)`,
  // IS NOT is null-safe: a missing revision cannot slip through as NULL.
  `CREATE TRIGGER review_revision_grant_video_insert BEFORE INSERT ON review_revision_grants WHEN NEW.video_id IS NOT (SELECT video_id FROM video_revisions WHERE id=NEW.revision_id) BEGIN SELECT RAISE(ABORT,'Grant must belong to the revision video'); END`,
  `CREATE TRIGGER review_revision_grant_video_update BEFORE UPDATE ON review_revision_grants WHEN NEW.video_id IS NOT (SELECT video_id FROM video_revisions WHERE id=NEW.revision_id) BEGIN SELECT RAISE(ABORT,'Grant must belong to the revision video'); END`,
  `CREATE TRIGGER review_revision_grant_identity BEFORE UPDATE ON review_revision_grants WHEN NEW.id IS NOT OLD.id OR NEW.video_id IS NOT OLD.video_id OR NEW.revision_id IS NOT OLD.revision_id OR NEW.user_id IS NOT OLD.user_id BEGIN SELECT RAISE(ABORT,'Grant identity is immutable'); END`,
  `CREATE TRIGGER review_revision_grant_delete BEFORE DELETE ON review_revision_grants BEGIN SELECT RAISE(ABORT,'Grant history is retained'); END`,
]
export const decisionUpdateTrigger = `CREATE TRIGGER review_decision_update BEFORE UPDATE ON review_decisions BEGIN SELECT RAISE(ABORT,'Review decisions are immutable'); END`
// Correlated subqueries avoid depending on UPDATE ... FROM.
export const decisionBackfill = (where = '') => `UPDATE review_decisions SET deliverable_checksum=(SELECT deliverable_checksum FROM video_revisions WHERE id=review_decisions.revision_id), source_checksum=(SELECT checksum FROM video_revisions WHERE id=review_decisions.revision_id), grant_id=(SELECT id FROM review_revision_grants WHERE revision_id=review_decisions.revision_id AND user_id=review_decisions.author_id)${where}`

/** Backfill historical and current grants with the canonical application CUID2 generator. */
export async function backfillRevisionGrants(db: GrantBackfillDB, now = new Date(), createId = createCuid2) {
  const grantedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString()
  const current = await db.all(sql`SELECT g.video_id, s.current_revision AS revision_id, g.user_id, g.can_approve, g.version
    FROM video_review_grants g JOIN video_review_state s ON s.video_id=g.video_id
    JOIN video_revisions r ON r.id=s.current_revision AND r.video_id=g.video_id
    WHERE g.active=1 AND s.current_revision IS NOT NULL`) as unknown as CurrentGrantCandidate[]
  const keys = new Set<string>()
  for (const grant of current) {
    keys.add(`${grant.revision_id}\u0000${grant.user_id}`)
    await db.run(sql`INSERT INTO review_revision_grants(${sql.raw(grantColumns)})
      VALUES(${createId()},${grant.video_id},${grant.revision_id},${grant.user_id},${grant.can_approve},${grant.version},NULL,${grantedAt},${expiresAt},NULL,NULL)
      ON CONFLICT(revision_id,user_id) DO NOTHING`)
  }
  const historical = await db.all(sql`SELECT DISTINCT g.video_id, r.id AS revision_id, g.user_id
    FROM video_review_grants g JOIN video_revisions r ON r.video_id=g.video_id
    WHERE g.active=1 AND (
      EXISTS(SELECT 1 FROM review_comments c WHERE c.revision_id=r.id AND c.author_id=g.user_id)
      OR EXISTS(SELECT 1 FROM review_decisions d WHERE d.revision_id=r.id AND d.author_id=g.user_id)
    )`) as unknown as HistoricalGrantCandidate[]
  for (const grant of historical) {
    const key = `${grant.revision_id}\u0000${grant.user_id}`
    if (keys.has(key)) continue
    keys.add(key)
    await db.run(sql`INSERT INTO review_revision_grants(${sql.raw(grantColumns)})
      VALUES(${createId()},${grant.video_id},${grant.revision_id},${grant.user_id},0,1,NULL,${grantedAt},${expiresAt},NULL,NULL)
      ON CONFLICT(revision_id,user_id) DO NOTHING`)
  }
}

export async function up({ db }: MigrateUpArgs) {
  for (const query of revisionGrantSchema) await db.run(sql.raw(query))
  for (const query of [
    'ALTER TABLE review_decisions ADD COLUMN deliverable_checksum TEXT',
    'ALTER TABLE review_decisions ADD COLUMN source_checksum TEXT',
    'ALTER TABLE review_decisions ADD COLUMN grant_id TEXT REFERENCES review_revision_grants(id)',
    'CREATE INDEX review_decisions_grant_idx ON review_decisions(grant_id)',
  ]) await db.run(sql.raw(query))
  await backfillRevisionGrants(db)
  for (const query of [
    // Keep these three adjacent: decisions are immutable except for this backfill.
    'DROP TRIGGER review_decision_update',
    decisionBackfill(),
    decisionUpdateTrigger,
  ]) await db.run(sql.raw(query))
}
export async function down({ db }: MigrateDownArgs) {
  // Backfilled rows alone do not block rollback; a staff share or revoke does.
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'revision-grants-rollback',CASE WHEN EXISTS(SELECT 1 FROM review_revision_grants WHERE granted_by_id IS NOT NULL OR revoked_by_id IS NOT NULL) THEN 0 ELSE 1 END;`)
  for (const query of [
    'DROP INDEX review_decisions_grant_idx',
    'DROP TRIGGER review_decision_update',
    'ALTER TABLE review_decisions DROP COLUMN grant_id',
    'ALTER TABLE review_decisions DROP COLUMN source_checksum',
    'ALTER TABLE review_decisions DROP COLUMN deliverable_checksum',
    decisionUpdateTrigger,
  ]) await db.run(sql.raw(query))
  for (const name of ['review_revision_grant_video_insert', 'review_revision_grant_video_update', 'review_revision_grant_identity', 'review_revision_grant_delete']) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  for (const name of ['video', 'revision', 'user', 'granted_by', 'revoked_by']) await db.run(sql.raw(`DROP INDEX review_revision_grants_${name}_idx`))
  await db.run(sql`DROP TABLE review_revision_grants;`)
  await db.run(sql`DELETE FROM review_command_guards WHERE id='revision-grants-rollback';`)
}
