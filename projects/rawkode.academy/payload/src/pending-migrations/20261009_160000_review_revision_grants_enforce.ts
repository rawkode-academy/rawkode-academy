import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'
import { decisionBackfill, decisionUpdateTrigger, legacyMirrorTriggers, mirrorTriggerNames } from '../migrations/20261009_130000_review_revision_grants'

// CONTRACT step of the revision grant rollout. It lives outside src/migrations on
// purpose: `payload migrate` (and so deploy.migrate) runs every file in migrationDir,
// whether or not index.ts lists it. Only after the expand release's deploy.main is live,
// so no Worker still writes legacy grants, move it into src/migrations, fix the import
// below, and register it in index.ts as the last migration.
export const decisionPinTrigger = `CREATE TRIGGER review_decision_pin BEFORE INSERT ON review_decisions WHEN NEW.deliverable_checksum IS NOT (SELECT deliverable_checksum FROM video_revisions WHERE id=NEW.revision_id) OR NEW.source_checksum IS NOT (SELECT checksum FROM video_revisions WHERE id=NEW.revision_id) OR NEW.grant_id IS NULL OR NOT EXISTS(SELECT 1 FROM review_revision_grants WHERE id=NEW.grant_id AND revision_id=NEW.revision_id AND user_id=NEW.author_id AND version=NEW.grant_version AND can_approve=1 AND revoked_at IS NULL) BEGIN SELECT RAISE(ABORT,'Decision must pin the revision bytes and grant'); END`
export const retireLegacySchema = ['INSERT', 'UPDATE', 'DELETE'].map(operation => `CREATE TRIGGER video_review_grants_retired_${operation.toLowerCase()} BEFORE ${operation} ON video_review_grants BEGIN SELECT RAISE(ABORT,'Use revision grants'); END`)

export async function up({ db }: MigrateUpArgs) {
  for (const name of mirrorTriggerNames) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  for (const query of [
    // Decisions the previous Worker recorded during the expand window. Keep adjacent.
    'DROP TRIGGER review_decision_update',
    decisionBackfill(' WHERE deliverable_checksum IS NULL'),
    decisionUpdateTrigger,
    decisionPinTrigger,
    ...retireLegacySchema,
  ]) await db.run(sql.raw(query))
}
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`DROP TRIGGER review_decision_pin;`)
  for (const operation of ['insert', 'update', 'delete']) await db.run(sql.raw(`DROP TRIGGER video_review_grants_retired_${operation}`))
  for (const query of legacyMirrorTriggers) await db.run(sql.raw(query))
}
