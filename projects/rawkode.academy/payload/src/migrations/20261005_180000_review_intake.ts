import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'

// Internal tables, intentionally outside Payload collection CRUD/snapshots.
export const intakeSchema = [
  `CREATE TABLE review_upload_sessions (id TEXT PRIMARY KEY NOT NULL, begin_command TEXT UNIQUE NOT NULL, begin_input TEXT NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id), video_id INTEGER NOT NULL REFERENCES videos(id), object_key TEXT UNIQUE NOT NULL, output_key TEXT UNIQUE NOT NULL, expected_bytes INTEGER NOT NULL CHECK(expected_bytes BETWEEN 1 AND 67108864), expected_checksum TEXT NOT NULL, claimed_type TEXT NOT NULL, metadata TEXT NOT NULL, revision_command TEXT UNIQUE NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','uploaded','processing','ready','cancelled')), source_etag TEXT, attestation TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX review_upload_sessions_owner_idx ON review_upload_sessions(owner_id)`,
  `CREATE INDEX review_upload_sessions_video_idx ON review_upload_sessions(video_id)`,
  `CREATE TABLE review_intake_assets (media_id INTEGER PRIMARY KEY NOT NULL REFERENCES media(id) ON DELETE RESTRICT, session_id TEXT NOT NULL REFERENCES review_upload_sessions(id) ON DELETE RESTRICT, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, kind TEXT NOT NULL CHECK(kind IN ('source','deliverable')), object_key TEXT UNIQUE NOT NULL, object_etag TEXT NOT NULL, checksum TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 67108864), content_type TEXT NOT NULL, duration_ms INTEGER, UNIQUE(session_id,kind))`,
  `CREATE INDEX review_intake_assets_video_idx ON review_intake_assets(video_id)`,
  `CREATE TRIGGER review_intake_asset_update BEFORE UPDATE ON review_intake_assets BEGIN SELECT RAISE(ABORT,'Intake assets are immutable'); END`,
  `CREATE TRIGGER review_intake_asset_delete BEFORE DELETE ON review_intake_assets BEGIN SELECT RAISE(ABORT,'Intake assets are retained'); END`,
  `CREATE TRIGGER review_intake_media_update BEFORE UPDATE ON media WHEN EXISTS(SELECT 1 FROM review_intake_assets WHERE media_id=OLD.id OR media_id=NEW.id) BEGIN SELECT RAISE(ABORT,'Intake media are immutable'); END`,
  `CREATE TRIGGER review_intake_media_delete BEFORE DELETE ON media WHEN EXISTS(SELECT 1 FROM review_intake_assets WHERE media_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Intake media are retained'); END`,
  `CREATE TRIGGER review_upload_identity BEFORE UPDATE ON review_upload_sessions WHEN OLD.state IN ('ready','cancelled') OR NEW.id!=OLD.id OR NEW.begin_command!=OLD.begin_command OR NEW.begin_input!=OLD.begin_input OR NEW.owner_id!=OLD.owner_id OR NEW.video_id!=OLD.video_id OR NEW.object_key!=OLD.object_key OR NEW.output_key!=OLD.output_key OR NEW.expected_bytes!=OLD.expected_bytes OR NEW.expected_checksum!=OLD.expected_checksum OR NEW.claimed_type!=OLD.claimed_type OR NEW.metadata!=OLD.metadata OR NEW.revision_command!=OLD.revision_command OR NEW.created_at!=OLD.created_at OR NEW.expires_at!=OLD.expires_at BEGIN SELECT RAISE(ABORT,'Upload identity is immutable'); END`,
]
export async function up({ db }: MigrateUpArgs) { for (const statement of intakeSchema) await db.run(sql.raw(statement)) }
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'intake-rollback',CASE WHEN EXISTS(SELECT 1 FROM review_upload_sessions) THEN 0 ELSE 1 END;`)
  for (const name of ['review_upload_identity','review_intake_media_delete','review_intake_media_update','review_intake_asset_delete','review_intake_asset_update']) await db.run(sql.raw(`DROP TRIGGER ${name}`))
  await db.run(sql`DROP TABLE review_intake_assets;`)
  await db.run(sql`DROP TABLE review_upload_sessions;`)
  await db.run(sql`DELETE FROM review_command_guards WHERE id='intake-rollback';`)
}
