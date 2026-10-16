import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'

// Studio review handoff. Internal tables, intentionally outside Payload collection
// CRUD and snapshots, like review_intake_assets. Studio objects are adopted in place
// in rawkode-academy-content; nothing here is ever copied or deleted.
const identityColumns = ['id', 'idempotency_key', 'input_hash', 'video_id', 'legacy_video_id', 'studio_session_id', 'recording_id', 'source_bucket', 'source_key', 'source_etag', 'source_bytes', 'source_format', 'review_prefix', 'metadata', 'requested_by', 'actor_id', 'revision_command', 'created_at']
export const studioAdoptionSchema = [
  `CREATE TABLE review_studio_adoptions (id TEXT PRIMARY KEY NOT NULL, idempotency_key TEXT UNIQUE NOT NULL, input_hash TEXT NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, legacy_video_id TEXT NOT NULL, studio_session_id TEXT NOT NULL, recording_id TEXT NOT NULL, source_bucket TEXT NOT NULL, source_key TEXT UNIQUE NOT NULL, source_etag TEXT NOT NULL, source_bytes INTEGER NOT NULL CHECK(source_bytes BETWEEN 1 AND 53687091200), source_format TEXT NOT NULL CHECK(source_format IN ('webm','mkv','mp4')), review_prefix TEXT UNIQUE NOT NULL, metadata TEXT NOT NULL, requested_by TEXT, actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, revision_command TEXT UNIQUE NOT NULL, expected_current_revision TEXT, state TEXT NOT NULL CHECK(state IN ('awaiting-transcode','failed','attached')), status_etag TEXT, revision_id TEXT REFERENCES video_revisions(id) ON DELETE RESTRICT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, CHECK((state='attached')=(revision_id IS NOT NULL)))`,
  `CREATE INDEX review_studio_adoptions_state_idx ON review_studio_adoptions(state,updated_at)`,
  `CREATE INDEX review_studio_adoptions_video_idx ON review_studio_adoptions(video_id)`,
  `CREATE TABLE review_studio_assets (media_id INTEGER PRIMARY KEY NOT NULL REFERENCES media(id) ON DELETE RESTRICT, adoption_id TEXT NOT NULL REFERENCES review_studio_adoptions(id) ON DELETE RESTRICT, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, kind TEXT NOT NULL CHECK(kind IN ('source','deliverable')), bucket TEXT NOT NULL, object_key TEXT UNIQUE NOT NULL, object_etag TEXT NOT NULL, checksum TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 53687091200), content_type TEXT NOT NULL, duration_ms INTEGER, UNIQUE(adoption_id,kind))`,
  `CREATE INDEX review_studio_assets_video_idx ON review_studio_assets(video_id)`,
  `CREATE TRIGGER review_studio_adoption_identity BEFORE UPDATE ON review_studio_adoptions WHEN ${identityColumns.map(column => `NEW.${column} IS NOT OLD.${column}`).join(' OR ')} BEGIN SELECT RAISE(ABORT,'Studio adoption identity is immutable'); END`,
  // awaiting-transcode and failed move freely between each other; attached is
  // terminal, and revision_id is set exactly once, together with the move to attached.
  `CREATE TRIGGER review_studio_adoption_transition BEFORE UPDATE ON review_studio_adoptions WHEN OLD.state='attached' OR (NEW.revision_id IS NOT OLD.revision_id AND NOT (OLD.revision_id IS NULL AND NEW.state='attached')) BEGIN SELECT RAISE(ABORT,'Studio adoption transition is not allowed'); END`,
  `CREATE TRIGGER review_studio_adoption_delete BEFORE DELETE ON review_studio_adoptions BEGIN SELECT RAISE(ABORT,'Studio adoptions are retained'); END`,
  `CREATE TRIGGER review_studio_asset_update BEFORE UPDATE ON review_studio_assets BEGIN SELECT RAISE(ABORT,'Studio assets are immutable'); END`,
  `CREATE TRIGGER review_studio_asset_delete BEFORE DELETE ON review_studio_assets BEGIN SELECT RAISE(ABORT,'Studio assets are retained'); END`,
  `CREATE TRIGGER review_studio_media_update BEFORE UPDATE ON media WHEN EXISTS(SELECT 1 FROM review_studio_assets WHERE media_id=OLD.id OR media_id=NEW.id) BEGIN SELECT RAISE(ABORT,'Studio media are immutable'); END`,
  `CREATE TRIGGER review_studio_media_delete BEFORE DELETE ON media WHEN EXISTS(SELECT 1 FROM review_studio_assets WHERE media_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Studio media are retained'); END`,
]
export const studioAdoptionTriggers = ['review_studio_adoption_identity', 'review_studio_adoption_transition', 'review_studio_adoption_delete', 'review_studio_asset_update', 'review_studio_asset_delete', 'review_studio_media_update', 'review_studio_media_delete']
export async function up({ db }: MigrateUpArgs) { for (const statement of studioAdoptionSchema) await db.run(sql.raw(statement)) }
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'studio-adoptions-rollback',CASE WHEN EXISTS(SELECT 1 FROM review_studio_adoptions) THEN 0 ELSE 1 END;`)
  for (const name of studioAdoptionTriggers) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  for (const name of ['review_studio_assets_video_idx', 'review_studio_adoptions_video_idx', 'review_studio_adoptions_state_idx']) await db.run(sql.raw(`DROP INDEX ${name}`))
  await db.run(sql`DROP TABLE review_studio_assets;`)
  await db.run(sql`DROP TABLE review_studio_adoptions;`)
  await db.run(sql`DELETE FROM review_command_guards WHERE id='studio-adoptions-rollback';`)
}
