import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`created_at\` text,
	\`expires_at\` text NOT NULL,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`name\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`email\` text NOT NULL,
	\`reset_password_token\` text,
	\`reset_password_expiration\` text,
	\`salt\` text,
	\`hash\` text,
	\`reset_password_requested_at\` text,
	\`login_attempts\` numeric DEFAULT 0,
	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`deletion_markers\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`key\` text NOT NULL,
	\`collection_slug\` text,
	\`legacy_id\` text,
	\`source_hash\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`deletion_markers_key_idx\` ON \`deletion_markers\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`deletion_markers_updated_at_idx\` ON \`deletion_markers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`deletion_markers_created_at_idx\` ON \`deletion_markers\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`videos_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`videos_terms_order_idx\` ON \`videos_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`videos_terms_parent_id_idx\` ON \`videos_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`videos\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`subtitle\` text,
	\`description\` text,
	\`published_at\` text,
	\`duration\` numeric,
	\`type\` text,
	\`category\` text,
	\`stream_url\` text,
	\`thumbnail_url\` text,
	\`media_reference\` text,
	\`episode_id\` integer,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`episode_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`videos_legacy_id_idx\` ON \`videos\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`videos_slug_idx\` ON \`videos\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`videos_episode_idx\` ON \`videos\` (\`episode_id\`);`)
  await db.run(sql`CREATE INDEX \`videos_updated_at_idx\` ON \`videos\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`videos_created_at_idx\` ON \`videos\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`videos__status_idx\` ON \`videos\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`videos_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`technologies_id\` integer,
	\`people_id\` integer,
	\`chapters_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`chapters_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`videos_rels_order_idx\` ON \`videos_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`videos_rels_parent_idx\` ON \`videos_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`videos_rels_path_idx\` ON \`videos_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`videos_rels_technologies_id_idx\` ON \`videos_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE INDEX \`videos_rels_people_id_idx\` ON \`videos_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`videos_rels_chapters_id_idx\` ON \`videos_rels\` (\`chapters_id\`);`)
  await db.run(sql`CREATE TABLE \`_videos_v_version_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_videos_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_videos_v_version_terms_order_idx\` ON \`_videos_v_version_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_terms_parent_id_idx\` ON \`_videos_v_version_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_videos_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_subtitle\` text,
	\`version_description\` text,
	\`version_published_at\` text,
	\`version_duration\` numeric,
	\`version_type\` text,
	\`version_category\` text,
	\`version_stream_url\` text,
	\`version_thumbnail_url\` text,
	\`version_media_reference\` text,
	\`version_episode_id\` integer,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_episode_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_videos_v_parent_idx\` ON \`_videos_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_legacy_id_idx\` ON \`_videos_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_slug_idx\` ON \`_videos_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_episode_idx\` ON \`_videos_v\` (\`version_episode_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_updated_at_idx\` ON \`_videos_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_created_at_idx\` ON \`_videos_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version__status_idx\` ON \`_videos_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_created_at_idx\` ON \`_videos_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_updated_at_idx\` ON \`_videos_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_latest_idx\` ON \`_videos_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_videos_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`technologies_id\` integer,
	\`people_id\` integer,
	\`chapters_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_videos_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`chapters_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_order_idx\` ON \`_videos_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_parent_idx\` ON \`_videos_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_path_idx\` ON \`_videos_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_technologies_id_idx\` ON \`_videos_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_people_id_idx\` ON \`_videos_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_rels_chapters_id_idx\` ON \`_videos_v_rels\` (\`chapters_id\`);`)
  await db.run(sql`CREATE TABLE \`people_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`people_terms_order_idx\` ON \`people_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`people_terms_parent_id_idx\` ON \`people_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`people_links\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text,
	\`url\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`people_links_order_idx\` ON \`people_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`people_links_parent_id_idx\` ON \`people_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`people\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`name\` text,
	\`forename\` text,
	\`surname\` text,
	\`github_handle\` text,
	\`github_url\` text,
	\`avatar_url\` text,
	\`biography\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`people_legacy_id_idx\` ON \`people\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`people_slug_idx\` ON \`people\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`people_updated_at_idx\` ON \`people\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`people_created_at_idx\` ON \`people\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`people__status_idx\` ON \`people\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_people_v_version_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_people_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_people_v_version_terms_order_idx\` ON \`_people_v_version_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_terms_parent_id_idx\` ON \`_people_v_version_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_people_v_version_links\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`name\` text,
	\`url\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_people_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_people_v_version_links_order_idx\` ON \`_people_v_version_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_links_parent_id_idx\` ON \`_people_v_version_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_people_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_name\` text,
	\`version_forename\` text,
	\`version_surname\` text,
	\`version_github_handle\` text,
	\`version_github_url\` text,
	\`version_avatar_url\` text,
	\`version_biography\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_people_v_parent_idx\` ON \`_people_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_version_legacy_id_idx\` ON \`_people_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_version_slug_idx\` ON \`_people_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_version_updated_at_idx\` ON \`_people_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_version_created_at_idx\` ON \`_people_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_version_version__status_idx\` ON \`_people_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_created_at_idx\` ON \`_people_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_updated_at_idx\` ON \`_people_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_people_v_latest_idx\` ON \`_people_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`technologies_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`technologies_terms_order_idx\` ON \`technologies_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`technologies_terms_parent_id_idx\` ON \`technologies_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`technologies_aliases\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`technologies_aliases_order_idx\` ON \`technologies_aliases\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`technologies_aliases_parent_id_idx\` ON \`technologies_aliases\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`technologies_features\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`technologies_features_order_idx\` ON \`technologies_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`technologies_features_parent_id_idx\` ON \`technologies_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`technologies_related_technologies\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`technologies_related_technologies_order_idx\` ON \`technologies_related_technologies\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`technologies_related_technologies_parent_id_idx\` ON \`technologies_related_technologies\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`technologies_use_cases\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`technologies_use_cases_order_idx\` ON \`technologies_use_cases\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`technologies_use_cases_parent_id_idx\` ON \`technologies_use_cases\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`technologies\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`name\` text,
	\`category\` text,
	\`subcategory\` text,
	\`documentation\` text,
	\`icon\` text,
	\`logo\` text,
	\`source\` text,
	\`status\` text,
	\`website\` text,
	\`learning_resources_id\` integer,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`technologies_legacy_id_idx\` ON \`technologies\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`technologies_slug_idx\` ON \`technologies\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`technologies_learning_resources_idx\` ON \`technologies\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE INDEX \`technologies_updated_at_idx\` ON \`technologies\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`technologies_created_at_idx\` ON \`technologies\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`technologies__status_idx\` ON \`technologies\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v_version_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_technologies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_terms_order_idx\` ON \`_technologies_v_version_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_terms_parent_id_idx\` ON \`_technologies_v_version_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v_version_aliases\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_technologies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_aliases_order_idx\` ON \`_technologies_v_version_aliases\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_aliases_parent_id_idx\` ON \`_technologies_v_version_aliases\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v_version_features\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_technologies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_features_order_idx\` ON \`_technologies_v_version_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_features_parent_id_idx\` ON \`_technologies_v_version_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v_version_related_technologies\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_technologies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_related_technologies_order_idx\` ON \`_technologies_v_version_related_technologies\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_related_technologies_parent_id_idx\` ON \`_technologies_v_version_related_technologies\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v_version_use_cases\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_technologies_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_use_cases_order_idx\` ON \`_technologies_v_version_use_cases\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_use_cases_parent_id_idx\` ON \`_technologies_v_version_use_cases\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_technologies_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_name\` text,
	\`version_category\` text,
	\`version_subcategory\` text,
	\`version_documentation\` text,
	\`version_icon\` text,
	\`version_logo\` text,
	\`version_source\` text,
	\`version_status\` text,
	\`version_website\` text,
	\`version_learning_resources_id\` integer,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_technologies_v_parent_idx\` ON \`_technologies_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version_legacy_id_idx\` ON \`_technologies_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version_slug_idx\` ON \`_technologies_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version_learning_resources_idx\` ON \`_technologies_v\` (\`version_learning_resources_id\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version_updated_at_idx\` ON \`_technologies_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version_created_at_idx\` ON \`_technologies_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_version_version__status_idx\` ON \`_technologies_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_created_at_idx\` ON \`_technologies_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_updated_at_idx\` ON \`_technologies_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_technologies_v_latest_idx\` ON \`_technologies_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`shows_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`shows_terms_order_idx\` ON \`shows_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`shows_terms_parent_id_idx\` ON \`shows_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`shows\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`name\` text,
	\`description\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`shows_legacy_id_idx\` ON \`shows\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`shows_slug_idx\` ON \`shows\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`shows_updated_at_idx\` ON \`shows\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`shows_created_at_idx\` ON \`shows\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`shows__status_idx\` ON \`shows\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`shows_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` integer,
	\`episodes_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`episodes_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`shows_rels_order_idx\` ON \`shows_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`shows_rels_parent_idx\` ON \`shows_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`shows_rels_path_idx\` ON \`shows_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`shows_rels_people_id_idx\` ON \`shows_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`shows_rels_episodes_id_idx\` ON \`shows_rels\` (\`episodes_id\`);`)
  await db.run(sql`CREATE TABLE \`_shows_v_version_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_shows_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_shows_v_version_terms_order_idx\` ON \`_shows_v_version_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_terms_parent_id_idx\` ON \`_shows_v_version_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_shows_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_name\` text,
	\`version_description\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_shows_v_parent_idx\` ON \`_shows_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_version_legacy_id_idx\` ON \`_shows_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_version_slug_idx\` ON \`_shows_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_version_updated_at_idx\` ON \`_shows_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_version_created_at_idx\` ON \`_shows_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_version_version__status_idx\` ON \`_shows_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_created_at_idx\` ON \`_shows_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_updated_at_idx\` ON \`_shows_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_latest_idx\` ON \`_shows_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_shows_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` integer,
	\`episodes_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_shows_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`episodes_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_shows_v_rels_order_idx\` ON \`_shows_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_rels_parent_idx\` ON \`_shows_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_rels_path_idx\` ON \`_shows_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_rels_people_id_idx\` ON \`_shows_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`_shows_v_rels_episodes_id_idx\` ON \`_shows_v_rels\` (\`episodes_id\`);`)
  await db.run(sql`CREATE TABLE \`episodes_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`episodes_terms_order_idx\` ON \`episodes_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`episodes_terms_parent_id_idx\` ON \`episodes_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`episodes\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`code\` text,
	\`video_id\` integer,
	\`show_id\` integer,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`video_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`show_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`episodes_legacy_id_idx\` ON \`episodes\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`episodes_slug_idx\` ON \`episodes\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`episodes_video_idx\` ON \`episodes\` (\`video_id\`);`)
  await db.run(sql`CREATE INDEX \`episodes_show_idx\` ON \`episodes\` (\`show_id\`);`)
  await db.run(sql`CREATE INDEX \`episodes_updated_at_idx\` ON \`episodes\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`episodes_created_at_idx\` ON \`episodes\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`episodes__status_idx\` ON \`episodes\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_episodes_v_version_terms\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_episodes_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_terms_order_idx\` ON \`_episodes_v_version_terms\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_terms_parent_id_idx\` ON \`_episodes_v_version_terms\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_episodes_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_code\` text,
	\`version_video_id\` integer,
	\`version_show_id\` integer,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`episodes\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_video_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_show_id\`) REFERENCES \`shows\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_episodes_v_parent_idx\` ON \`_episodes_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_legacy_id_idx\` ON \`_episodes_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_slug_idx\` ON \`_episodes_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_video_idx\` ON \`_episodes_v\` (\`version_video_id\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_show_idx\` ON \`_episodes_v\` (\`version_show_id\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_updated_at_idx\` ON \`_episodes_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version_created_at_idx\` ON \`_episodes_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_version_version__status_idx\` ON \`_episodes_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_created_at_idx\` ON \`_episodes_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_updated_at_idx\` ON \`_episodes_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_episodes_v_latest_idx\` ON \`_episodes_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`chapters\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`start_time\` numeric,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`chapters_legacy_id_idx\` ON \`chapters\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`chapters_slug_idx\` ON \`chapters\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`chapters_updated_at_idx\` ON \`chapters\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`chapters_created_at_idx\` ON \`chapters\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`chapters__status_idx\` ON \`chapters\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_chapters_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_start_time\` numeric,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`chapters\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_chapters_v_parent_idx\` ON \`_chapters_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_version_version_legacy_id_idx\` ON \`_chapters_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_version_version_slug_idx\` ON \`_chapters_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_version_version_updated_at_idx\` ON \`_chapters_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_version_version_created_at_idx\` ON \`_chapters_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_version_version__status_idx\` ON \`_chapters_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_created_at_idx\` ON \`_chapters_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_updated_at_idx\` ON \`_chapters_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_chapters_v_latest_idx\` ON \`_chapters_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`learning_resources_official\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`url\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`learning_resources_official_order_idx\` ON \`learning_resources_official\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_official_parent_id_idx\` ON \`learning_resources_official\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`learning_resources_community\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`url\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`learning_resources_community_order_idx\` ON \`learning_resources_community\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_community_parent_id_idx\` ON \`learning_resources_community\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`learning_resources_tutorials\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`url\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`learning_resources_tutorials_order_idx\` ON \`learning_resources_tutorials\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_tutorials_parent_id_idx\` ON \`learning_resources_tutorials\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`learning_resources\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`learning_resources_legacy_id_idx\` ON \`learning_resources\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_slug_idx\` ON \`learning_resources\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_updated_at_idx\` ON \`learning_resources\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources_created_at_idx\` ON \`learning_resources\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`learning_resources__status_idx\` ON \`learning_resources\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_learning_resources_v_version_official\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`url\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_learning_resources_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_official_order_idx\` ON \`_learning_resources_v_version_official\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_official_parent_id_idx\` ON \`_learning_resources_v_version_official\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_learning_resources_v_version_community\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`url\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_learning_resources_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_community_order_idx\` ON \`_learning_resources_v_version_community\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_community_parent_id_idx\` ON \`_learning_resources_v_version_community\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_learning_resources_v_version_tutorials\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`url\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_learning_resources_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_tutorials_order_idx\` ON \`_learning_resources_v_version_tutorials\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_tutorials_parent_id_idx\` ON \`_learning_resources_v_version_tutorials\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_learning_resources_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_parent_idx\` ON \`_learning_resources_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_version_legacy_id_idx\` ON \`_learning_resources_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_version_slug_idx\` ON \`_learning_resources_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_version_updated_at_idx\` ON \`_learning_resources_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_version_created_at_idx\` ON \`_learning_resources_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_version_version__status_idx\` ON \`_learning_resources_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_created_at_idx\` ON \`_learning_resources_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_updated_at_idx\` ON \`_learning_resources_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_resources_v_latest_idx\` ON \`_learning_resources_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`articles\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`description\` text,
	\`published_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`articles_legacy_id_idx\` ON \`articles\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_slug_idx\` ON \`articles\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`articles_updated_at_idx\` ON \`articles\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`articles_created_at_idx\` ON \`articles\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`articles__status_idx\` ON \`articles\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`articles_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` integer,
	\`technologies_id\` integer,
	\`learning_resources_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`articles_rels_order_idx\` ON \`articles_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_parent_idx\` ON \`articles_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_path_idx\` ON \`articles_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_people_id_idx\` ON \`articles_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_technologies_id_idx\` ON \`articles_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE INDEX \`articles_rels_learning_resources_id_idx\` ON \`articles_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_description\` text,
	\`version_published_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`articles\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_parent_idx\` ON \`_articles_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_legacy_id_idx\` ON \`_articles_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_slug_idx\` ON \`_articles_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_updated_at_idx\` ON \`_articles_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_created_at_idx\` ON \`_articles_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version__status_idx\` ON \`_articles_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_created_at_idx\` ON \`_articles_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_updated_at_idx\` ON \`_articles_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_latest_idx\` ON \`_articles_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_articles_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` integer,
	\`technologies_id\` integer,
	\`learning_resources_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_articles_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_order_idx\` ON \`_articles_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_parent_idx\` ON \`_articles_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_path_idx\` ON \`_articles_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_people_id_idx\` ON \`_articles_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_technologies_id_idx\` ON \`_articles_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE INDEX \`_articles_v_rels_learning_resources_id_idx\` ON \`_articles_v_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`courses\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`description\` text,
	\`published_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`courses_legacy_id_idx\` ON \`courses\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`courses_slug_idx\` ON \`courses\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`courses_updated_at_idx\` ON \`courses\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`courses_created_at_idx\` ON \`courses\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`courses__status_idx\` ON \`courses\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`courses_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`course_modules_id\` integer,
	\`people_id\` integer,
	\`technologies_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`course_modules_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`courses_rels_order_idx\` ON \`courses_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`courses_rels_parent_idx\` ON \`courses_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`courses_rels_path_idx\` ON \`courses_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`courses_rels_course_modules_id_idx\` ON \`courses_rels\` (\`course_modules_id\`);`)
  await db.run(sql`CREATE INDEX \`courses_rels_people_id_idx\` ON \`courses_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`courses_rels_technologies_id_idx\` ON \`courses_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`_courses_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_description\` text,
	\`version_published_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_courses_v_parent_idx\` ON \`_courses_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version_legacy_id_idx\` ON \`_courses_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version_slug_idx\` ON \`_courses_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version_updated_at_idx\` ON \`_courses_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version_created_at_idx\` ON \`_courses_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version__status_idx\` ON \`_courses_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_created_at_idx\` ON \`_courses_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_updated_at_idx\` ON \`_courses_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_latest_idx\` ON \`_courses_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_courses_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`course_modules_id\` integer,
	\`people_id\` integer,
	\`technologies_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_courses_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`course_modules_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_order_idx\` ON \`_courses_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_parent_idx\` ON \`_courses_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_path_idx\` ON \`_courses_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_course_modules_id_idx\` ON \`_courses_v_rels\` (\`course_modules_id\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_people_id_idx\` ON \`_courses_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_rels_technologies_id_idx\` ON \`_courses_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`course_modules\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`description\` text,
	\`order\` numeric,
	\`section\` text,
	\`course_id\` integer,
	\`video_id\` integer,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`video_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`course_modules_legacy_id_idx\` ON \`course_modules\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_slug_idx\` ON \`course_modules\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_course_idx\` ON \`course_modules\` (\`course_id\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_video_idx\` ON \`course_modules\` (\`video_id\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_updated_at_idx\` ON \`course_modules\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_created_at_idx\` ON \`course_modules\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`course_modules__status_idx\` ON \`course_modules\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`course_modules_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`learning_resources_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`course_modules_rels_order_idx\` ON \`course_modules_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_parent_idx\` ON \`course_modules_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_path_idx\` ON \`course_modules_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_learning_resources_id_idx\` ON \`course_modules_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`_course_modules_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_description\` text,
	\`version_order\` numeric,
	\`version_section\` text,
	\`version_course_id\` integer,
	\`version_video_id\` integer,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_course_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_video_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_course_modules_v_parent_idx\` ON \`_course_modules_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_legacy_id_idx\` ON \`_course_modules_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_slug_idx\` ON \`_course_modules_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_course_idx\` ON \`_course_modules_v\` (\`version_course_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_video_idx\` ON \`_course_modules_v\` (\`version_video_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_updated_at_idx\` ON \`_course_modules_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version_created_at_idx\` ON \`_course_modules_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_version__status_idx\` ON \`_course_modules_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_created_at_idx\` ON \`_course_modules_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_updated_at_idx\` ON \`_course_modules_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_latest_idx\` ON \`_course_modules_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_course_modules_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`learning_resources_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_course_modules_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_order_idx\` ON \`_course_modules_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_parent_idx\` ON \`_course_modules_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_path_idx\` ON \`_course_modules_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_learning_resources_id_idx\` ON \`_course_modules_v_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`learning_paths_prerequisites\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`learning_paths\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`learning_paths_prerequisites_order_idx\` ON \`learning_paths_prerequisites\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_prerequisites_parent_id_idx\` ON \`learning_paths_prerequisites\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`learning_paths\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`legacy_id\` text,
	\`legacy_type\` text,
	\`slug\` text,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_order\` numeric DEFAULT 0,
	\`source_body\` text,
	\`tombstone\` integer DEFAULT false,
	\`title\` text,
	\`description\` text,
	\`difficulty\` text,
	\`estimated_duration\` numeric,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`learning_paths_legacy_id_idx\` ON \`learning_paths\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_slug_idx\` ON \`learning_paths\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_updated_at_idx\` ON \`learning_paths\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_created_at_idx\` ON \`learning_paths\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths__status_idx\` ON \`learning_paths\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`learning_paths_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`courses_id\` integer,
	\`videos_id\` integer,
	\`technologies_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`learning_paths\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`courses_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`videos_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_order_idx\` ON \`learning_paths_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_parent_idx\` ON \`learning_paths_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_path_idx\` ON \`learning_paths_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_courses_id_idx\` ON \`learning_paths_rels\` (\`courses_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_videos_id_idx\` ON \`learning_paths_rels\` (\`videos_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_technologies_id_idx\` ON \`learning_paths_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`_learning_paths_v_version_prerequisites\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_learning_paths_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_prerequisites_order_idx\` ON \`_learning_paths_v_version_prerequisites\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_prerequisites_parent_id_idx\` ON \`_learning_paths_v_version_prerequisites\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_learning_paths_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` integer,
	\`version_legacy_id\` text,
	\`version_legacy_type\` text,
	\`version_slug\` text,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_body\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_title\` text,
	\`version_description\` text,
	\`version_difficulty\` text,
	\`version_estimated_duration\` numeric,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`learning_paths\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_parent_idx\` ON \`_learning_paths_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_version_legacy_id_idx\` ON \`_learning_paths_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_version_slug_idx\` ON \`_learning_paths_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_version_updated_at_idx\` ON \`_learning_paths_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_version_created_at_idx\` ON \`_learning_paths_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_version_version__status_idx\` ON \`_learning_paths_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_created_at_idx\` ON \`_learning_paths_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_updated_at_idx\` ON \`_learning_paths_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_latest_idx\` ON \`_learning_paths_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_learning_paths_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`courses_id\` integer,
	\`videos_id\` integer,
	\`technologies_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_learning_paths_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`courses_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`videos_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_order_idx\` ON \`_learning_paths_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_parent_idx\` ON \`_learning_paths_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_path_idx\` ON \`_learning_paths_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_courses_id_idx\` ON \`_learning_paths_v_rels\` (\`courses_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_videos_id_idx\` ON \`_learning_paths_v_rels\` (\`videos_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_technologies_id_idx\` ON \`_learning_paths_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`alt\` text,
	\`_objectkey\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`url\` text,
	\`thumbnail_u_r_l\` text,
	\`filename\` text,
	\`mime_type\` text,
	\`filesize\` numeric,
	\`width\` numeric,
	\`height\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`key\` text NOT NULL,
	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`global_slug\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
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
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`key\` text,
	\`value\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`users_id\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`name\` text,
	\`batch\` numeric,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`deletion_markers\`;`)
  await db.run(sql`DROP TABLE \`videos_terms\`;`)
  await db.run(sql`DROP TABLE \`videos\`;`)
  await db.run(sql`DROP TABLE \`videos_rels\`;`)
  await db.run(sql`DROP TABLE \`_videos_v_version_terms\`;`)
  await db.run(sql`DROP TABLE \`_videos_v\`;`)
  await db.run(sql`DROP TABLE \`_videos_v_rels\`;`)
  await db.run(sql`DROP TABLE \`people_terms\`;`)
  await db.run(sql`DROP TABLE \`people_links\`;`)
  await db.run(sql`DROP TABLE \`people\`;`)
  await db.run(sql`DROP TABLE \`_people_v_version_terms\`;`)
  await db.run(sql`DROP TABLE \`_people_v_version_links\`;`)
  await db.run(sql`DROP TABLE \`_people_v\`;`)
  await db.run(sql`DROP TABLE \`technologies_terms\`;`)
  await db.run(sql`DROP TABLE \`technologies_aliases\`;`)
  await db.run(sql`DROP TABLE \`technologies_features\`;`)
  await db.run(sql`DROP TABLE \`technologies_related_technologies\`;`)
  await db.run(sql`DROP TABLE \`technologies_use_cases\`;`)
  await db.run(sql`DROP TABLE \`technologies\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v_version_terms\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v_version_aliases\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v_version_features\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v_version_related_technologies\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v_version_use_cases\`;`)
  await db.run(sql`DROP TABLE \`_technologies_v\`;`)
  await db.run(sql`DROP TABLE \`shows_terms\`;`)
  await db.run(sql`DROP TABLE \`shows\`;`)
  await db.run(sql`DROP TABLE \`shows_rels\`;`)
  await db.run(sql`DROP TABLE \`_shows_v_version_terms\`;`)
  await db.run(sql`DROP TABLE \`_shows_v\`;`)
  await db.run(sql`DROP TABLE \`_shows_v_rels\`;`)
  await db.run(sql`DROP TABLE \`episodes_terms\`;`)
  await db.run(sql`DROP TABLE \`episodes\`;`)
  await db.run(sql`DROP TABLE \`_episodes_v_version_terms\`;`)
  await db.run(sql`DROP TABLE \`_episodes_v\`;`)
  await db.run(sql`DROP TABLE \`chapters\`;`)
  await db.run(sql`DROP TABLE \`_chapters_v\`;`)
  await db.run(sql`DROP TABLE \`learning_resources_official\`;`)
  await db.run(sql`DROP TABLE \`learning_resources_community\`;`)
  await db.run(sql`DROP TABLE \`learning_resources_tutorials\`;`)
  await db.run(sql`DROP TABLE \`learning_resources\`;`)
  await db.run(sql`DROP TABLE \`_learning_resources_v_version_official\`;`)
  await db.run(sql`DROP TABLE \`_learning_resources_v_version_community\`;`)
  await db.run(sql`DROP TABLE \`_learning_resources_v_version_tutorials\`;`)
  await db.run(sql`DROP TABLE \`_learning_resources_v\`;`)
  await db.run(sql`DROP TABLE \`articles\`;`)
  await db.run(sql`DROP TABLE \`articles_rels\`;`)
  await db.run(sql`DROP TABLE \`_articles_v\`;`)
  await db.run(sql`DROP TABLE \`_articles_v_rels\`;`)
  await db.run(sql`DROP TABLE \`courses\`;`)
  await db.run(sql`DROP TABLE \`courses_rels\`;`)
  await db.run(sql`DROP TABLE \`_courses_v\`;`)
  await db.run(sql`DROP TABLE \`_courses_v_rels\`;`)
  await db.run(sql`DROP TABLE \`course_modules\`;`)
  await db.run(sql`DROP TABLE \`course_modules_rels\`;`)
  await db.run(sql`DROP TABLE \`_course_modules_v\`;`)
  await db.run(sql`DROP TABLE \`_course_modules_v_rels\`;`)
  await db.run(sql`DROP TABLE \`learning_paths_prerequisites\`;`)
  await db.run(sql`DROP TABLE \`learning_paths\`;`)
  await db.run(sql`DROP TABLE \`learning_paths_rels\`;`)
  await db.run(sql`DROP TABLE \`_learning_paths_v_version_prerequisites\`;`)
  await db.run(sql`DROP TABLE \`_learning_paths_v\`;`)
  await db.run(sql`DROP TABLE \`_learning_paths_v_rels\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}
