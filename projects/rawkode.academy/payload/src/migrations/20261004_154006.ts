import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`payload_mcp_api_keys\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`user_id\` integer NOT NULL,
	\`label\` text,
	\`description\` text,
	\`videos_find\` integer DEFAULT false,
	\`videos_create\` integer DEFAULT false,
	\`videos_update\` integer DEFAULT false,
	\`articles_find\` integer DEFAULT false,
	\`articles_create\` integer DEFAULT false,
	\`articles_update\` integer DEFAULT false,
	\`courses_find\` integer DEFAULT false,
	\`courses_create\` integer DEFAULT false,
	\`courses_update\` integer DEFAULT false,
	\`course_modules_find\` integer DEFAULT false,
	\`course_modules_create\` integer DEFAULT false,
	\`course_modules_update\` integer DEFAULT false,
	\`learning_paths_find\` integer DEFAULT false,
	\`learning_paths_create\` integer DEFAULT false,
	\`learning_paths_update\` integer DEFAULT false,
	\`shows_find\` integer DEFAULT false,
	\`shows_create\` integer DEFAULT false,
	\`shows_update\` integer DEFAULT false,
	\`episodes_find\` integer DEFAULT false,
	\`episodes_create\` integer DEFAULT false,
	\`episodes_update\` integer DEFAULT false,
	\`technologies_find\` integer DEFAULT false,
	\`technologies_create\` integer DEFAULT false,
	\`technologies_update\` integer DEFAULT false,
	\`people_find\` integer DEFAULT false,
	\`people_create\` integer DEFAULT false,
	\`people_update\` integer DEFAULT false,
	\`chapters_find\` integer DEFAULT false,
	\`chapters_create\` integer DEFAULT false,
	\`chapters_update\` integer DEFAULT false,
	\`learning_resources_find\` integer DEFAULT false,
	\`learning_resources_create\` integer DEFAULT false,
	\`learning_resources_update\` integer DEFAULT false,
	\`academy_settings_find\` integer DEFAULT false,
	\`academy_settings_update\` integer DEFAULT false,
	\`payload_mcp_tool_academy_import_status\` integer DEFAULT true,
	\`payload_mcp_resource_academy_compatibility_policy\` integer DEFAULT true,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`enable_a_p_i_key\` integer,
	\`api_key\` text,
	\`api_key_index\` text,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_user_idx\` ON \`payload_mcp_api_keys\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_updated_at_idx\` ON \`payload_mcp_api_keys\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_mcp_api_keys_created_at_idx\` ON \`payload_mcp_api_keys\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`academy_settings\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`editorial_note\` text DEFAULT 'Experimental local catalogue',
	\`updated_at\` text,
	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payload_mcp_api_keys_id\` integer REFERENCES payload_mcp_api_keys(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payload_mcp_api_keys_id_idx\` ON \`payload_locked_documents_rels\` (\`payload_mcp_api_keys_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_preferences_rels\` ADD \`payload_mcp_api_keys_id\` integer REFERENCES payload_mcp_api_keys(id);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_payload_mcp_api_keys_id_idx\` ON \`payload_preferences_rels\` (\`payload_mcp_api_keys_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`payload_mcp_api_keys\`;`)
  await db.run(sql`DROP TABLE \`academy_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`users_id\` integer,
	\`deletion_markers_id\` integer,
	\`videos_id\` integer,
	\`people_id\` integer,
	\`technologies_id\` integer,
	\`shows_id\` integer,
	\`episodes_id\` integer,
	\`chapters_id\` integer,
	\`learning_resources_id\` integer,
	\`articles_id\` integer,
	\`courses_id\` integer,
	\`course_modules_id\` integer,
	\`learning_paths_id\` integer,
	\`media_id\` integer,
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
	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
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
  await db.run(sql`CREATE TABLE \`__new_payload_preferences_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`users_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_preferences_rels\`("id", "order", "parent_id", "path", "users_id") SELECT "id", "order", "parent_id", "path", "users_id" FROM \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_preferences_rels\` RENAME TO \`payload_preferences_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
}
