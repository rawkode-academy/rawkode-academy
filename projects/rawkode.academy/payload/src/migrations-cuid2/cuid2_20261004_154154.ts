import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pipeline_runs\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`key\` text NOT NULL,
	\`video_id\` text NOT NULL,
	\`media_id\` text NOT NULL,
	\`checksum\` text,
	\`video_version\` text,
	\`workflow_id\` text,
	\`manifest_key\` text,
	\`generated_revision\` text,
	\`approved_revision\` text,
	\`state\` text NOT NULL,
	\`provider\` text,
	\`transcript\` text,
	\`summary\` text,
	\`chapters\` text,
	\`transcription_attempts\` numeric,
	\`human_edited\` integer DEFAULT false,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (\`video_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pipeline_runs_key_idx\` ON \`pipeline_runs\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`pipeline_runs_video_idx\` ON \`pipeline_runs\` (\`video_id\`);`)
  await db.run(sql`CREATE INDEX \`pipeline_runs_media_idx\` ON \`pipeline_runs\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`pipeline_runs_updated_at_idx\` ON \`pipeline_runs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pipeline_runs_created_at_idx\` ON \`pipeline_runs\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`processing_state\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`transcript\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`summary\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`media_checksum\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`media_version\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`approval_revision\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`processing_run\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_processing_state\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_transcript\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_summary\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_media_checksum\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_media_version\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_approval_revision\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_processing_run\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_sequence\` numeric;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pipeline_runs_id\` text REFERENCES pipeline_runs(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pipeline_runs_id_idx\` ON \`payload_locked_documents_rels\` (\`pipeline_runs_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pipeline_runs\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`users_id\` text,
	\`deletion_markers_id\` text,
	\`videos_id\` text,
	\`people_id\` text,
	\`technologies_id\` text,
	\`shows_id\` text,
	\`episodes_id\` text,
	\`chapters_id\` text,
	\`learning_resources_id\` text,
	\`articles_id\` text,
	\`courses_id\` text,
	\`course_modules_id\` text,
	\`learning_paths_id\` text,
	\`media_id\` text,
	\`payload_mcp_api_keys_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`deletion_markers_id\`) REFERENCES \`deletion_markers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`videos_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`shows_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`episodes_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`chapters_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`articles_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`courses_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`course_modules_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_paths_id\`) REFERENCES \`learning_paths\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`payload_mcp_api_keys_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_deletion_markers_id_idx\` ON \`payload_locked_documents_rels\` (\`deletion_markers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_videos_id_idx\` ON \`payload_locked_documents_rels\` (\`videos_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_people_id_idx\` ON \`payload_locked_documents_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_technologies_id_idx\` ON \`payload_locked_documents_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_shows_id_idx\` ON \`payload_locked_documents_rels\` (\`shows_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_episodes_id_idx\` ON \`payload_locked_documents_rels\` (\`episodes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_chapters_id_idx\` ON \`payload_locked_documents_rels\` (\`chapters_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_learning_resources_id_idx\` ON \`payload_locked_documents_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_articles_id_idx\` ON \`payload_locked_documents_rels\` (\`articles_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_courses_id_idx\` ON \`payload_locked_documents_rels\` (\`courses_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_course_modules_id_idx\` ON \`payload_locked_documents_rels\` (\`course_modules_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_learning_paths_id_idx\` ON \`payload_locked_documents_rels\` (\`learning_paths_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payload_mcp_api_keys_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_mcp_api_keys_id\`);`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`processing_state\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`transcript\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`summary\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`media_checksum\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`media_version\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`approval_revision\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`processing_run\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_processing_state\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_transcript\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_summary\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_media_checksum\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_media_version\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_approval_revision\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_processing_run\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_sequence\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_sequence\`;`)
}
