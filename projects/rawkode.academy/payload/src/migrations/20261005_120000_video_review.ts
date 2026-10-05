import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'

export const reviewSchema = [
  `CREATE TABLE video_review_state (video_id INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE RESTRICT, generation INTEGER NOT NULL, current_revision TEXT)`,
  `CREATE TABLE video_revisions (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT, checksum TEXT NOT NULL, deliverable_media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT, deliverable_checksum TEXT NOT NULL, duration_ms INTEGER NOT NULL CHECK(duration_ms>0), review_version INTEGER NOT NULL CHECK(review_version>0), state TEXT NOT NULL, metadata TEXT NOT NULL, decision_id TEXT, created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at TEXT NOT NULL)`,
  `CREATE INDEX video_revisions_video_idx ON video_revisions(video_id)`,
  `CREATE INDEX video_revisions_media_idx ON video_revisions(media_id)`,
  `CREATE INDEX video_revisions_deliverable_media_idx ON video_revisions(deliverable_media_id)`,
  `CREATE INDEX video_revisions_created_by_idx ON video_revisions(created_by_id)`,
  `CREATE TABLE video_review_grants (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, version INTEGER NOT NULL DEFAULT 1, can_approve INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, UNIQUE(video_id,user_id))`,
  `CREATE INDEX video_review_grants_video_idx ON video_review_grants(video_id)`,
  `CREATE INDEX video_review_grants_user_idx ON video_review_grants(user_id)`,
  `CREATE TABLE review_comments (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, revision_id TEXT NOT NULL REFERENCES video_revisions(id) ON DELETE RESTRICT, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, start_ms INTEGER NOT NULL CHECK(start_ms>=0), end_ms INTEGER, body TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, resolved_by_id INTEGER REFERENCES users(id), resolved_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE review_comment_resolutions (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, comment_id TEXT NOT NULL REFERENCES review_comments(id) ON DELETE RESTRICT, actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, resolved INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TRIGGER review_resolution_update BEFORE UPDATE ON review_comment_resolutions BEGIN SELECT RAISE(ABORT,'Resolution history is immutable'); END`,
  `CREATE TRIGGER review_resolution_delete BEFORE DELETE ON review_comment_resolutions BEGIN SELECT RAISE(ABORT,'Resolution history is immutable'); END`,
  `CREATE INDEX review_comments_video_idx ON review_comments(video_id)`,
  `CREATE INDEX review_comments_revision_idx ON review_comments(revision_id)`,
  `CREATE INDEX review_comments_author_idx ON review_comments(author_id)`,
  `CREATE INDEX review_comments_resolved_by_idx ON review_comments(resolved_by_id)`,
  `CREATE TABLE review_decisions (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, revision_id TEXT NOT NULL REFERENCES video_revisions(id) ON DELETE RESTRICT, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, review_version INTEGER NOT NULL, grant_version INTEGER NOT NULL, decision TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX review_decisions_video_idx ON review_decisions(video_id)`,
  `CREATE INDEX review_decisions_revision_idx ON review_decisions(revision_id)`,
  `CREATE INDEX review_decisions_author_idx ON review_decisions(author_id)`,
  `CREATE TABLE video_publications (id INTEGER PRIMARY KEY NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, document TEXT NOT NULL)`,
  `CREATE TABLE review_publication_events (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, revision_id TEXT NOT NULL REFERENCES video_revisions(id) ON DELETE RESTRICT, decision_id TEXT NOT NULL REFERENCES review_decisions(id) ON DELETE RESTRICT, published_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, published_at TEXT NOT NULL, object_key TEXT NOT NULL, object_etag TEXT NOT NULL, checksum TEXT NOT NULL, bytes INTEGER NOT NULL, content_type TEXT NOT NULL)`,
  `CREATE TABLE review_commands (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, input_hash TEXT NOT NULL, result TEXT NOT NULL)`,
  `CREATE TRIGGER review_revision_final BEFORE UPDATE ON video_revisions WHEN OLD.state IN ('approved','published') AND NOT (OLD.state='approved' AND NEW.state='published' AND NEW.id=OLD.id AND NEW.video_id=OLD.video_id AND NEW.media_id=OLD.media_id AND NEW.deliverable_media_id=OLD.deliverable_media_id AND NEW.checksum=OLD.checksum AND NEW.deliverable_checksum=OLD.deliverable_checksum AND NEW.duration_ms=OLD.duration_ms AND NEW.review_version=OLD.review_version AND NEW.metadata=OLD.metadata AND NEW.decision_id IS OLD.decision_id AND NEW.created_by_id=OLD.created_by_id AND NEW.created_at=OLD.created_at) BEGIN SELECT RAISE(ABORT,'Approved revision is immutable'); END`,
  `CREATE TRIGGER review_revision_delete BEFORE DELETE ON video_revisions BEGIN SELECT RAISE(ABORT,'Review revision history is immutable'); END`,
  `CREATE TRIGGER review_decision_update BEFORE UPDATE ON review_decisions BEGIN SELECT RAISE(ABORT,'Review decisions are immutable'); END`,
  `CREATE TRIGGER review_decision_delete BEFORE DELETE ON review_decisions BEGIN SELECT RAISE(ABORT,'Review decisions are immutable'); END`,
  `CREATE TRIGGER review_publication_update BEFORE UPDATE ON review_publication_events BEGIN SELECT RAISE(ABORT,'Publication history is immutable'); END`,
  `CREATE TRIGGER review_publication_delete BEFORE DELETE ON review_publication_events BEGIN SELECT RAISE(ABORT,'Publication history is immutable'); END`,
  // A failed precondition must abort the entire D1 batch, not silently update zero rows.
  `CREATE TABLE review_command_guards (id TEXT PRIMARY KEY NOT NULL, valid INTEGER NOT NULL CHECK(valid=1))`,

]
// Protect every Payload child write as well as parent updates. Payload's D1
// adapter does not wrap its multi-table writes in one transaction.
const frozenTables = [
  ['videos','id',false], ['_videos_v','parent_id',false],
  ['videos_terms','_parent_id',false], ['videos_what_you_will_learn','_parent_id',false], ['videos_rels','parent_id',false],
  ['_videos_v_version_terms','_parent_id',true], ['_videos_v_version_what_you_will_learn','_parent_id',true], ['_videos_v_rels','parent_id',true],
  ['pipeline_runs','video_id',false],
] as const
export const freezeTriggers = frozenTables.flatMap(([table,parent,version]) => ['INSERT','UPDATE','DELETE'].map(operation => {
  const membership = (row: string) => version
    ? `EXISTS(SELECT 1 FROM video_review_state s JOIN _videos_v v ON s.video_id=v.parent_id WHERE v.id=${row}.${parent})`
    : `EXISTS(SELECT 1 FROM video_review_state WHERE video_id=${row}.${parent})`
  const condition = operation === 'INSERT' ? membership('NEW') : operation === 'DELETE' ? membership('OLD') : `${membership('OLD')} OR ${membership('NEW')}`
  return { name: `review_freeze_${table}_${operation.toLowerCase()}`, statement: `CREATE TRIGGER review_freeze_${table}_${operation.toLowerCase()} BEFORE ${operation} ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT,'Managed video: use review commands'); END` }
}))
export async function up({ db }: MigrateUpArgs) {
  for (const statement of [...reviewSchema, ...freezeTriggers.map(trigger => trigger.statement)]) await db.run(sql.raw(statement))
}
export async function down({ db }: MigrateDownArgs) {
  // Application rollback must retain review history and releases. Refuse a schema
  // downgrade once this feature has real records instead of silently deleting them.
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'rollback',CASE WHEN EXISTS(SELECT 1 FROM video_review_state) THEN 0 ELSE 1 END;`)
  for (const name of ['review_resolution_update','review_resolution_delete','review_revision_final','review_revision_delete','review_decision_update','review_decision_delete','review_publication_update','review_publication_delete']) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  for (const { name } of freezeTriggers) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  for (const name of ['review_command_guards','review_commands','review_publication_events','video_publications','review_decisions','review_comment_resolutions','review_comments','video_review_grants','video_revisions','video_review_state']) await db.run(sql.raw(`DROP TABLE ${name}`))
}
