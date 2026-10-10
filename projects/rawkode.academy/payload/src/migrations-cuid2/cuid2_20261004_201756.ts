import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`videos_what_you_will_learn\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` text NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`videos_what_you_will_learn_order_idx\` ON \`videos_what_you_will_learn\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`videos_what_you_will_learn_parent_id_idx\` ON \`videos_what_you_will_learn\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_videos_v_version_what_you_will_learn\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` text NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_videos_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_videos_v_version_what_you_will_learn_order_idx\` ON \`_videos_v_version_what_you_will_learn\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_what_you_will_learn_parent_id_idx\` ON \`_videos_v_version_what_you_will_learn\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`courses_learning_path\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` text NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`courses_learning_path_order_idx\` ON \`courses_learning_path\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`courses_learning_path_parent_id_idx\` ON \`courses_learning_path\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_courses_v_version_learning_path\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_courses_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_courses_v_version_learning_path_order_idx\` ON \`_courses_v_version_learning_path\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_learning_path_parent_id_idx\` ON \`_courses_v_version_learning_path\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`series\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`body\` text,
	\`cover\` text,
	\`content_resources\` text,
	\`editorial_data\` text,
	\`title\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`series_legacy_id_idx\` ON \`series\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`series_slug_idx\` ON \`series\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`series_updated_at_idx\` ON \`series\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`series_created_at_idx\` ON \`series\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`series__status_idx\` ON \`series\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_series_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_body\` text,
	\`version_cover\` text,
	\`version_content_resources\` text,
	\`version_editorial_data\` text,
	\`version_title\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`series\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_series_v_parent_idx\` ON \`_series_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_version_version_legacy_id_idx\` ON \`_series_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_version_version_slug_idx\` ON \`_series_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_version_version_updated_at_idx\` ON \`_series_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_version_version_created_at_idx\` ON \`_series_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_version_version__status_idx\` ON \`_series_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_created_at_idx\` ON \`_series_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_updated_at_idx\` ON \`_series_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_series_v_latest_idx\` ON \`_series_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`adrs\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`body\` text,
	\`cover\` text,
	\`content_resources\` text,
	\`editorial_data\` text,
	\`title\` text,
	\`adopted_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`adrs_legacy_id_idx\` ON \`adrs\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`adrs_slug_idx\` ON \`adrs\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`adrs_updated_at_idx\` ON \`adrs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`adrs_created_at_idx\` ON \`adrs\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`adrs__status_idx\` ON \`adrs\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`adrs_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` text NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`adrs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`adrs_rels_order_idx\` ON \`adrs_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`adrs_rels_parent_idx\` ON \`adrs_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`adrs_rels_path_idx\` ON \`adrs_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`adrs_rels_people_id_idx\` ON \`adrs_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE TABLE \`_adrs_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_body\` text,
	\`version_cover\` text,
	\`version_content_resources\` text,
	\`version_editorial_data\` text,
	\`version_title\` text,
	\`version_adopted_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`adrs\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_adrs_v_parent_idx\` ON \`_adrs_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_version_version_legacy_id_idx\` ON \`_adrs_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_version_version_slug_idx\` ON \`_adrs_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_version_version_updated_at_idx\` ON \`_adrs_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_version_version_created_at_idx\` ON \`_adrs_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_version_version__status_idx\` ON \`_adrs_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_created_at_idx\` ON \`_adrs_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_updated_at_idx\` ON \`_adrs_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_latest_idx\` ON \`_adrs_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_adrs_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_adrs_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_adrs_v_rels_order_idx\` ON \`_adrs_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_rels_parent_idx\` ON \`_adrs_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_rels_path_idx\` ON \`_adrs_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_adrs_v_rels_people_id_idx\` ON \`_adrs_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE TABLE \`testimonials\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`body\` text,
	\`cover\` text,
	\`content_resources\` text,
	\`editorial_data\` text,
	\`quote\` text,
	\`author\` text,
	\`type\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`testimonials_legacy_id_idx\` ON \`testimonials\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_slug_idx\` ON \`testimonials\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_updated_at_idx\` ON \`testimonials\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonials_created_at_idx\` ON \`testimonials\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonials__status_idx\` ON \`testimonials\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_testimonials_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_body\` text,
	\`version_cover\` text,
	\`version_content_resources\` text,
	\`version_editorial_data\` text,
	\`version_quote\` text,
	\`version_author\` text,
	\`version_type\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`testimonials\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_testimonials_v_parent_idx\` ON \`_testimonials_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_legacy_id_idx\` ON \`_testimonials_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_slug_idx\` ON \`_testimonials_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_updated_at_idx\` ON \`_testimonials_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version_created_at_idx\` ON \`_testimonials_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_version_version__status_idx\` ON \`_testimonials_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_created_at_idx\` ON \`_testimonials_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_updated_at_idx\` ON \`_testimonials_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_testimonials_v_latest_idx\` ON \`_testimonials_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`news\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`body\` text,
	\`cover\` text,
	\`content_resources\` text,
	\`editorial_data\` text,
	\`title\` text,
	\`description\` text,
	\`published_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`news_legacy_id_idx\` ON \`news\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`news_slug_idx\` ON \`news\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`news_updated_at_idx\` ON \`news\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`news_created_at_idx\` ON \`news\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`news__status_idx\` ON \`news\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`news_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` text NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	\`technologies_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`news\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`news_rels_order_idx\` ON \`news_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`news_rels_parent_idx\` ON \`news_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`news_rels_path_idx\` ON \`news_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`news_rels_people_id_idx\` ON \`news_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`news_rels_technologies_id_idx\` ON \`news_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`_news_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_body\` text,
	\`version_cover\` text,
	\`version_content_resources\` text,
	\`version_editorial_data\` text,
	\`version_title\` text,
	\`version_description\` text,
	\`version_published_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`news\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_news_v_parent_idx\` ON \`_news_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_version_version_legacy_id_idx\` ON \`_news_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_version_version_slug_idx\` ON \`_news_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_version_version_updated_at_idx\` ON \`_news_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_version_version_created_at_idx\` ON \`_news_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_version_version__status_idx\` ON \`_news_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_created_at_idx\` ON \`_news_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_updated_at_idx\` ON \`_news_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_latest_idx\` ON \`_news_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_news_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	\`technologies_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_news_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_news_v_rels_order_idx\` ON \`_news_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_rels_parent_idx\` ON \`_news_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_rels_path_idx\` ON \`_news_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_rels_people_id_idx\` ON \`_news_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE INDEX \`_news_v_rels_technologies_id_idx\` ON \`_news_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`changelog\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`body\` text,
	\`cover\` text,
	\`content_resources\` text,
	\`editorial_data\` text,
	\`title\` text,
	\`description\` text,
	\`date\` text,
	\`type\` text,
	\`pull_request\` numeric,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`changelog_legacy_id_idx\` ON \`changelog\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`changelog_slug_idx\` ON \`changelog\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`changelog_updated_at_idx\` ON \`changelog\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`changelog_created_at_idx\` ON \`changelog\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`changelog__status_idx\` ON \`changelog\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`changelog_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` text NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`changelog\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`changelog_rels_order_idx\` ON \`changelog_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`changelog_rels_parent_idx\` ON \`changelog_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`changelog_rels_path_idx\` ON \`changelog_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`changelog_rels_people_id_idx\` ON \`changelog_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE TABLE \`_changelog_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_body\` text,
	\`version_cover\` text,
	\`version_content_resources\` text,
	\`version_editorial_data\` text,
	\`version_title\` text,
	\`version_description\` text,
	\`version_date\` text,
	\`version_type\` text,
	\`version_pull_request\` numeric,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`changelog\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_changelog_v_parent_idx\` ON \`_changelog_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_version_version_legacy_id_idx\` ON \`_changelog_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_version_version_slug_idx\` ON \`_changelog_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_version_version_updated_at_idx\` ON \`_changelog_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_version_version_created_at_idx\` ON \`_changelog_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_version_version__status_idx\` ON \`_changelog_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_created_at_idx\` ON \`_changelog_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_updated_at_idx\` ON \`_changelog_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_latest_idx\` ON \`_changelog_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_changelog_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`people_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_changelog_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`people_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_changelog_v_rels_order_idx\` ON \`_changelog_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_rels_parent_idx\` ON \`_changelog_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_rels_path_idx\` ON \`_changelog_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_changelog_v_rels_people_id_idx\` ON \`_changelog_v_rels\` (\`people_id\`);`)
  await db.run(sql`CREATE TABLE \`static_assets\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`legacy_id\` text NOT NULL,
	\`legacy_type\` text NOT NULL,
	\`slug\` text NOT NULL,
	\`source_system\` text,
	\`source_revision\` text,
	\`source_hash\` text,
	\`mapping_version\` text,
	\`imported_at\` text,
	\`import_state\` text,
	\`locally_edited\` integer DEFAULT true,
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`r2_key\` text,
	\`mime_type\` text,
	\`bytes\` numeric,
	\`checksum\` text,
	\`alt\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`static_assets_legacy_id_idx\` ON \`static_assets\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`static_assets_slug_idx\` ON \`static_assets\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`static_assets_updated_at_idx\` ON \`static_assets\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`static_assets_created_at_idx\` ON \`static_assets\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`_static_assets_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
	\`version_legacy_id\` text NOT NULL,
	\`version_legacy_type\` text NOT NULL,
	\`version_slug\` text NOT NULL,
	\`version_source_system\` text,
	\`version_source_revision\` text,
	\`version_source_hash\` text,
	\`version_mapping_version\` text,
	\`version_imported_at\` text,
	\`version_import_state\` text,
	\`version_locally_edited\` integer DEFAULT true,
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_r2_key\` text,
	\`version_mime_type\` text,
	\`version_bytes\` numeric,
	\`version_checksum\` text,
	\`version_alt\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`static_assets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_static_assets_v_parent_idx\` ON \`_static_assets_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_version_version_legacy_id_idx\` ON \`_static_assets_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_version_version_slug_idx\` ON \`_static_assets_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_version_version_updated_at_idx\` ON \`_static_assets_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_version_version_created_at_idx\` ON \`_static_assets_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_created_at_idx\` ON \`_static_assets_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_static_assets_v_updated_at_idx\` ON \`_static_assets_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`seasons\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`show_id\` text,
	\`name\` text,
	\`status\` text,
	\`start_date\` text,
	\`end_date\` text,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`seasons_legacy_id_idx\` ON \`seasons\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`seasons_slug_idx\` ON \`seasons\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`seasons_updated_at_idx\` ON \`seasons\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`seasons_created_at_idx\` ON \`seasons\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`seasons__status_idx\` ON \`seasons\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_seasons_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_show_id\` text,
	\`version_name\` text,
	\`version_status\` text,
	\`version_start_date\` text,
	\`version_end_date\` text,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_seasons_v_parent_idx\` ON \`_seasons_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_version_version_legacy_id_idx\` ON \`_seasons_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_version_version_slug_idx\` ON \`_seasons_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_version_version_updated_at_idx\` ON \`_seasons_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_version_version_created_at_idx\` ON \`_seasons_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_version_version__status_idx\` ON \`_seasons_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_created_at_idx\` ON \`_seasons_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_updated_at_idx\` ON \`_seasons_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_seasons_v_latest_idx\` ON \`_seasons_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`competitors\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`season_id\` text,
	\`person_slug\` text,
	\`display_name\` text,
	\`bio\` text,
	\`user_id\` text,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`competitors_legacy_id_idx\` ON \`competitors\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`competitors_slug_idx\` ON \`competitors\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`competitors_season_idx\` ON \`competitors\` (\`season_id\`);`)
  await db.run(sql`CREATE INDEX \`competitors_updated_at_idx\` ON \`competitors\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`competitors_created_at_idx\` ON \`competitors\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`competitors__status_idx\` ON \`competitors\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_competitors_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_season_id\` text,
	\`version_person_slug\` text,
	\`version_display_name\` text,
	\`version_bio\` text,
	\`version_user_id\` text,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_competitors_v_parent_idx\` ON \`_competitors_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version_legacy_id_idx\` ON \`_competitors_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version_slug_idx\` ON \`_competitors_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version_season_idx\` ON \`_competitors_v\` (\`version_season_id\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version_updated_at_idx\` ON \`_competitors_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version_created_at_idx\` ON \`_competitors_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_version_version__status_idx\` ON \`_competitors_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_created_at_idx\` ON \`_competitors_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_updated_at_idx\` ON \`_competitors_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_competitors_v_latest_idx\` ON \`_competitors_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`brackets\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`season_id\` text,
	\`name\` text,
	\`kind\` text,
	\`format\` text,
	\`status\` text,
	\`starts_at\` text,
	\`registration_closes_at\` text,
	\`max_entries\` numeric,
	\`team_size\` numeric,
	\`cadence_days\` numeric,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`brackets_legacy_id_idx\` ON \`brackets\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`brackets_slug_idx\` ON \`brackets\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`brackets_season_idx\` ON \`brackets\` (\`season_id\`);`)
  await db.run(sql`CREATE INDEX \`brackets_updated_at_idx\` ON \`brackets\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`brackets_created_at_idx\` ON \`brackets\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`brackets__status_idx\` ON \`brackets\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_brackets_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_season_id\` text,
	\`version_name\` text,
	\`version_kind\` text,
	\`version_format\` text,
	\`version_status\` text,
	\`version_starts_at\` text,
	\`version_registration_closes_at\` text,
	\`version_max_entries\` numeric,
	\`version_team_size\` numeric,
	\`version_cadence_days\` numeric,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_brackets_v_parent_idx\` ON \`_brackets_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version_legacy_id_idx\` ON \`_brackets_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version_slug_idx\` ON \`_brackets_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version_season_idx\` ON \`_brackets_v\` (\`version_season_id\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version_updated_at_idx\` ON \`_brackets_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version_created_at_idx\` ON \`_brackets_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_version_version__status_idx\` ON \`_brackets_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_created_at_idx\` ON \`_brackets_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_updated_at_idx\` ON \`_brackets_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_brackets_v_latest_idx\` ON \`_brackets_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`bracket_applications\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`bracket_id\` text,
	\`competitor_id\` text,
	\`status\` text,
	\`source_created_at\` text,
	\`reviewed_at\` text,
	\`reviewed_by_user_id\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`bracket_applications_legacy_id_idx\` ON \`bracket_applications\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications_slug_idx\` ON \`bracket_applications\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications_bracket_idx\` ON \`bracket_applications\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications_competitor_idx\` ON \`bracket_applications\` (\`competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications_updated_at_idx\` ON \`bracket_applications\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications_created_at_idx\` ON \`bracket_applications\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_applications__status_idx\` ON \`bracket_applications\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_bracket_applications_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_bracket_id\` text,
	\`version_competitor_id\` text,
	\`version_status\` text,
	\`version_source_created_at\` text,
	\`version_reviewed_at\` text,
	\`version_reviewed_by_user_id\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`bracket_applications\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_parent_idx\` ON \`_bracket_applications_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_legacy_id_idx\` ON \`_bracket_applications_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_slug_idx\` ON \`_bracket_applications_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_bracket_idx\` ON \`_bracket_applications_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_competitor_idx\` ON \`_bracket_applications_v\` (\`version_competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_updated_at_idx\` ON \`_bracket_applications_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version_created_at_idx\` ON \`_bracket_applications_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_version_version__status_idx\` ON \`_bracket_applications_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_created_at_idx\` ON \`_bracket_applications_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_updated_at_idx\` ON \`_bracket_applications_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_applications_v_latest_idx\` ON \`_bracket_applications_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`teams\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`season_id\` text,
	\`bracket_id\` text,
	\`name\` text,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`teams_legacy_id_idx\` ON \`teams\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`teams_slug_idx\` ON \`teams\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`teams_season_idx\` ON \`teams\` (\`season_id\`);`)
  await db.run(sql`CREATE INDEX \`teams_bracket_idx\` ON \`teams\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`teams_updated_at_idx\` ON \`teams\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`teams_created_at_idx\` ON \`teams\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`teams__status_idx\` ON \`teams\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_teams_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_season_id\` text,
	\`version_bracket_id\` text,
	\`version_name\` text,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_teams_v_parent_idx\` ON \`_teams_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_legacy_id_idx\` ON \`_teams_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_slug_idx\` ON \`_teams_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_season_idx\` ON \`_teams_v\` (\`version_season_id\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_bracket_idx\` ON \`_teams_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_updated_at_idx\` ON \`_teams_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version_created_at_idx\` ON \`_teams_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_version_version__status_idx\` ON \`_teams_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_created_at_idx\` ON \`_teams_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_updated_at_idx\` ON \`_teams_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_teams_v_latest_idx\` ON \`_teams_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`team_members\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`team_id\` text,
	\`bracket_id\` text,
	\`competitor_id\` text,
	\`role\` text,
	\`source_created_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`team_members_legacy_id_idx\` ON \`team_members\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`team_members_slug_idx\` ON \`team_members\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`team_members_team_idx\` ON \`team_members\` (\`team_id\`);`)
  await db.run(sql`CREATE INDEX \`team_members_bracket_idx\` ON \`team_members\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`team_members_competitor_idx\` ON \`team_members\` (\`competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`team_members_updated_at_idx\` ON \`team_members\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`team_members_created_at_idx\` ON \`team_members\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`team_members__status_idx\` ON \`team_members\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_team_members_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_team_id\` text,
	\`version_bracket_id\` text,
	\`version_competitor_id\` text,
	\`version_role\` text,
	\`version_source_created_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`team_members\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_team_members_v_parent_idx\` ON \`_team_members_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_legacy_id_idx\` ON \`_team_members_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_slug_idx\` ON \`_team_members_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_team_idx\` ON \`_team_members_v\` (\`version_team_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_bracket_idx\` ON \`_team_members_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_competitor_idx\` ON \`_team_members_v\` (\`version_competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_updated_at_idx\` ON \`_team_members_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version_created_at_idx\` ON \`_team_members_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_version_version__status_idx\` ON \`_team_members_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_created_at_idx\` ON \`_team_members_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_updated_at_idx\` ON \`_team_members_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_members_v_latest_idx\` ON \`_team_members_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`team_invites\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`token\` text,
	\`team_id\` text,
	\`bracket_id\` text,
	\`created_by_user_id\` text,
	\`source_created_at\` text,
	\`revoked_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`team_invites_legacy_id_idx\` ON \`team_invites\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`team_invites_slug_idx\` ON \`team_invites\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`team_invites_team_idx\` ON \`team_invites\` (\`team_id\`);`)
  await db.run(sql`CREATE INDEX \`team_invites_bracket_idx\` ON \`team_invites\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`team_invites_updated_at_idx\` ON \`team_invites\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`team_invites_created_at_idx\` ON \`team_invites\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`team_invites__status_idx\` ON \`team_invites\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_team_invites_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_token\` text,
	\`version_team_id\` text,
	\`version_bracket_id\` text,
	\`version_created_by_user_id\` text,
	\`version_source_created_at\` text,
	\`version_revoked_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`team_invites\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_team_invites_v_parent_idx\` ON \`_team_invites_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_legacy_id_idx\` ON \`_team_invites_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_slug_idx\` ON \`_team_invites_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_team_idx\` ON \`_team_invites_v\` (\`version_team_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_bracket_idx\` ON \`_team_invites_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_updated_at_idx\` ON \`_team_invites_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version_created_at_idx\` ON \`_team_invites_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_version_version__status_idx\` ON \`_team_invites_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_created_at_idx\` ON \`_team_invites_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_updated_at_idx\` ON \`_team_invites_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_team_invites_v_latest_idx\` ON \`_team_invites_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`bracket_breaks\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`bracket_id\` text,
	\`label\` text,
	\`starts_at\` text,
	\`ends_at\` text,
	\`source_created_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`bracket_breaks_legacy_id_idx\` ON \`bracket_breaks\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_breaks_slug_idx\` ON \`bracket_breaks\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`bracket_breaks_bracket_idx\` ON \`bracket_breaks\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_breaks_updated_at_idx\` ON \`bracket_breaks\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_breaks_created_at_idx\` ON \`bracket_breaks\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_breaks__status_idx\` ON \`bracket_breaks\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_bracket_breaks_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_bracket_id\` text,
	\`version_label\` text,
	\`version_starts_at\` text,
	\`version_ends_at\` text,
	\`version_source_created_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`bracket_breaks\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_parent_idx\` ON \`_bracket_breaks_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version_legacy_id_idx\` ON \`_bracket_breaks_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version_slug_idx\` ON \`_bracket_breaks_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version_bracket_idx\` ON \`_bracket_breaks_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version_updated_at_idx\` ON \`_bracket_breaks_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version_created_at_idx\` ON \`_bracket_breaks_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_version_version__status_idx\` ON \`_bracket_breaks_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_created_at_idx\` ON \`_bracket_breaks_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_updated_at_idx\` ON \`_bracket_breaks_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_breaks_v_latest_idx\` ON \`_bracket_breaks_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`bracket_entries\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`bracket_id\` text,
	\`competitor_id\` text,
	\`team_id\` text,
	\`display_name\` text,
	\`seed\` numeric,
	\`status\` text,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`bracket_entries_legacy_id_idx\` ON \`bracket_entries\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_slug_idx\` ON \`bracket_entries\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_bracket_idx\` ON \`bracket_entries\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_competitor_idx\` ON \`bracket_entries\` (\`competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_team_idx\` ON \`bracket_entries\` (\`team_id\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_updated_at_idx\` ON \`bracket_entries\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries_created_at_idx\` ON \`bracket_entries\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`bracket_entries__status_idx\` ON \`bracket_entries\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_bracket_entries_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_bracket_id\` text,
	\`version_competitor_id\` text,
	\`version_team_id\` text,
	\`version_display_name\` text,
	\`version_seed\` numeric,
	\`version_status\` text,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_competitor_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_parent_idx\` ON \`_bracket_entries_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_legacy_id_idx\` ON \`_bracket_entries_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_slug_idx\` ON \`_bracket_entries_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_bracket_idx\` ON \`_bracket_entries_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_competitor_idx\` ON \`_bracket_entries_v\` (\`version_competitor_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_team_idx\` ON \`_bracket_entries_v\` (\`version_team_id\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_updated_at_idx\` ON \`_bracket_entries_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version_created_at_idx\` ON \`_bracket_entries_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_version_version__status_idx\` ON \`_bracket_entries_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_created_at_idx\` ON \`_bracket_entries_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_updated_at_idx\` ON \`_bracket_entries_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_bracket_entries_v_latest_idx\` ON \`_bracket_entries_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`matches\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`bracket_id\` text,
	\`round_number\` numeric,
	\`position_in_round\` numeric,
	\`scheduled_at\` text,
	\`status\` text,
	\`team_a_id\` text,
	\`team_b_id\` text,
	\`entry_a_id\` text,
	\`entry_b_id\` text,
	\`judge_user_id\` text,
	\`winner_team_id\` text,
	\`winner_entry_id\` text,
	\`started_at\` text,
	\`ended_at\` text,
	\`source_created_at\` text,
	\`source_updated_at\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`team_a_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`team_b_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`entry_a_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`entry_b_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`winner_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`winner_entry_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`matches_legacy_id_idx\` ON \`matches\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_slug_idx\` ON \`matches\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`matches_bracket_idx\` ON \`matches\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_team_a_idx\` ON \`matches\` (\`team_a_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_team_b_idx\` ON \`matches\` (\`team_b_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_entry_a_idx\` ON \`matches\` (\`entry_a_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_entry_b_idx\` ON \`matches\` (\`entry_b_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_winner_team_idx\` ON \`matches\` (\`winner_team_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_winner_entry_idx\` ON \`matches\` (\`winner_entry_id\`);`)
  await db.run(sql`CREATE INDEX \`matches_updated_at_idx\` ON \`matches\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`matches_created_at_idx\` ON \`matches\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`matches__status_idx\` ON \`matches\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_matches_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_bracket_id\` text,
	\`version_round_number\` numeric,
	\`version_position_in_round\` numeric,
	\`version_scheduled_at\` text,
	\`version_status\` text,
	\`version_team_a_id\` text,
	\`version_team_b_id\` text,
	\`version_entry_a_id\` text,
	\`version_entry_b_id\` text,
	\`version_judge_user_id\` text,
	\`version_winner_team_id\` text,
	\`version_winner_entry_id\` text,
	\`version_started_at\` text,
	\`version_ended_at\` text,
	\`version_source_created_at\` text,
	\`version_source_updated_at\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`matches\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_team_a_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_team_b_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_entry_a_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_entry_b_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_winner_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_winner_entry_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_matches_v_parent_idx\` ON \`_matches_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_legacy_id_idx\` ON \`_matches_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_slug_idx\` ON \`_matches_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_bracket_idx\` ON \`_matches_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_team_a_idx\` ON \`_matches_v\` (\`version_team_a_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_team_b_idx\` ON \`_matches_v\` (\`version_team_b_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_entry_a_idx\` ON \`_matches_v\` (\`version_entry_a_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_entry_b_idx\` ON \`_matches_v\` (\`version_entry_b_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_winner_team_idx\` ON \`_matches_v\` (\`version_winner_team_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_winner_entry_idx\` ON \`_matches_v\` (\`version_winner_entry_id\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_updated_at_idx\` ON \`_matches_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version_created_at_idx\` ON \`_matches_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_version_version__status_idx\` ON \`_matches_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_created_at_idx\` ON \`_matches_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_updated_at_idx\` ON \`_matches_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_matches_v_latest_idx\` ON \`_matches_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`match_results\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`match_id\` text,
	\`winner_team_id\` text,
	\`winner_entry_id\` text,
	\`time_to_resolve_seconds\` numeric,
	\`score_a\` numeric,
	\`score_b\` numeric,
	\`notes\` text,
	\`recorded_at\` text,
	\`recorded_by_user_id\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`match_id\`) REFERENCES \`matches\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`winner_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`winner_entry_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`match_results_legacy_id_idx\` ON \`match_results\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`match_results_slug_idx\` ON \`match_results\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`match_results_match_idx\` ON \`match_results\` (\`match_id\`);`)
  await db.run(sql`CREATE INDEX \`match_results_winner_team_idx\` ON \`match_results\` (\`winner_team_id\`);`)
  await db.run(sql`CREATE INDEX \`match_results_winner_entry_idx\` ON \`match_results\` (\`winner_entry_id\`);`)
  await db.run(sql`CREATE INDEX \`match_results_updated_at_idx\` ON \`match_results\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`match_results_created_at_idx\` ON \`match_results\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`match_results__status_idx\` ON \`match_results\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_match_results_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_match_id\` text,
	\`version_winner_team_id\` text,
	\`version_winner_entry_id\` text,
	\`version_time_to_resolve_seconds\` numeric,
	\`version_score_a\` numeric,
	\`version_score_b\` numeric,
	\`version_notes\` text,
	\`version_recorded_at\` text,
	\`version_recorded_by_user_id\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`match_results\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_match_id\`) REFERENCES \`matches\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_winner_team_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_winner_entry_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_match_results_v_parent_idx\` ON \`_match_results_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_legacy_id_idx\` ON \`_match_results_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_slug_idx\` ON \`_match_results_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_match_idx\` ON \`_match_results_v\` (\`version_match_id\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_winner_team_idx\` ON \`_match_results_v\` (\`version_winner_team_id\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_winner_entry_idx\` ON \`_match_results_v\` (\`version_winner_entry_id\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_updated_at_idx\` ON \`_match_results_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version_created_at_idx\` ON \`_match_results_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_version_version__status_idx\` ON \`_match_results_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_created_at_idx\` ON \`_match_results_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_updated_at_idx\` ON \`_match_results_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_match_results_v_latest_idx\` ON \`_match_results_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`registrations\` (
	\`id\` text PRIMARY KEY NOT NULL,
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
	\`source_fields\` text,
	\`source_sequence\` numeric,
	\`source_order\` numeric DEFAULT 0,
	\`source_path\` text,
	\`source_format\` text,
	\`source_data\` text,
	\`source_raw\` text,
	\`source_body\` text,
	\`source_assets\` text,
	\`tombstone\` integer DEFAULT false,
	\`season_id\` text,
	\`bracket_id\` text,
	\`entry_type\` text,
	\`team_name\` text,
	\`preferred_slot\` numeric,
	\`user_id\` text,
	\`display_name\` text,
	\`email\` text,
	\`message\` text,
	\`status\` text,
	\`submitted_at\` text,
	\`reviewed_at\` text,
	\`reviewed_by_user_id\` text,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`_status\` text DEFAULT 'draft',
	FOREIGN KEY (\`season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`registrations_legacy_id_idx\` ON \`registrations\` (\`legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`registrations_slug_idx\` ON \`registrations\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`registrations_season_idx\` ON \`registrations\` (\`season_id\`);`)
  await db.run(sql`CREATE INDEX \`registrations_bracket_idx\` ON \`registrations\` (\`bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`registrations_updated_at_idx\` ON \`registrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`registrations_created_at_idx\` ON \`registrations\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`registrations__status_idx\` ON \`registrations\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_registrations_v\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`parent_id\` text,
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
	\`version_source_fields\` text,
	\`version_source_sequence\` numeric,
	\`version_source_order\` numeric DEFAULT 0,
	\`version_source_path\` text,
	\`version_source_format\` text,
	\`version_source_data\` text,
	\`version_source_raw\` text,
	\`version_source_body\` text,
	\`version_source_assets\` text,
	\`version_tombstone\` integer DEFAULT false,
	\`version_season_id\` text,
	\`version_bracket_id\` text,
	\`version_entry_type\` text,
	\`version_team_name\` text,
	\`version_preferred_slot\` numeric,
	\`version_user_id\` text,
	\`version_display_name\` text,
	\`version_email\` text,
	\`version_message\` text,
	\`version_status\` text,
	\`version_submitted_at\` text,
	\`version_reviewed_at\` text,
	\`version_reviewed_by_user_id\` text,
	\`version_updated_at\` text,
	\`version_created_at\` text,
	\`version__status\` text DEFAULT 'draft',
	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	\`latest\` integer,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`registrations\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_season_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`version_bracket_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_registrations_v_parent_idx\` ON \`_registrations_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_legacy_id_idx\` ON \`_registrations_v\` (\`version_legacy_id\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_slug_idx\` ON \`_registrations_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_season_idx\` ON \`_registrations_v\` (\`version_season_id\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_bracket_idx\` ON \`_registrations_v\` (\`version_bracket_id\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_updated_at_idx\` ON \`_registrations_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version_created_at_idx\` ON \`_registrations_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_version_version__status_idx\` ON \`_registrations_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_created_at_idx\` ON \`_registrations_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_updated_at_idx\` ON \`_registrations_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_registrations_v_latest_idx\` ON \`_registrations_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`pipeline_runs_id\` text,
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
	\`series_id\` text,
	\`adrs_id\` text,
	\`testimonials_id\` text,
	\`news_id\` text,
	\`changelog_id\` text,
	\`static_assets_id\` text,
	\`seasons_id\` text,
	\`competitors_id\` text,
	\`brackets_id\` text,
	\`bracket_applications_id\` text,
	\`teams_id\` text,
	\`team_members_id\` text,
	\`team_invites_id\` text,
	\`bracket_breaks_id\` text,
	\`bracket_entries_id\` text,
	\`matches_id\` text,
	\`match_results_id\` text,
	\`registrations_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`pipeline_runs_id\`) REFERENCES \`pipeline_runs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
	FOREIGN KEY (\`payload_mcp_api_keys_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`series_id\`) REFERENCES \`series\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`adrs_id\`) REFERENCES \`adrs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`testimonials_id\`) REFERENCES \`testimonials\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`news_id\`) REFERENCES \`news\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`changelog_id\`) REFERENCES \`changelog\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`static_assets_id\`) REFERENCES \`static_assets\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`seasons_id\`) REFERENCES \`seasons\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`competitors_id\`) REFERENCES \`competitors\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`brackets_id\`) REFERENCES \`brackets\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`bracket_applications_id\`) REFERENCES \`bracket_applications\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`teams_id\`) REFERENCES \`teams\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`team_members_id\`) REFERENCES \`team_members\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`team_invites_id\`) REFERENCES \`team_invites\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`bracket_breaks_id\`) REFERENCES \`bracket_breaks\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`bracket_entries_id\`) REFERENCES \`bracket_entries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`matches_id\`) REFERENCES \`matches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`match_results_id\`) REFERENCES \`match_results\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`registrations_id\`) REFERENCES \`registrations\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "pipeline_runs_id", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id", "series_id", "adrs_id", "testimonials_id", "news_id", "changelog_id", "static_assets_id", "seasons_id", "competitors_id", "brackets_id", "bracket_applications_id", "teams_id", "team_members_id", "team_invites_id", "bracket_breaks_id", "bracket_entries_id", "matches_id", "match_results_id", "registrations_id") SELECT "id", "order", "parent_id", "path", "pipeline_runs_id", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id", NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pipeline_runs_id_idx\` ON \`payload_locked_documents_rels\` (\`pipeline_runs_id\`);`)
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
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_series_id_idx\` ON \`payload_locked_documents_rels\` (\`series_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_adrs_id_idx\` ON \`payload_locked_documents_rels\` (\`adrs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_testimonials_id_idx\` ON \`payload_locked_documents_rels\` (\`testimonials_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_news_id_idx\` ON \`payload_locked_documents_rels\` (\`news_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_changelog_id_idx\` ON \`payload_locked_documents_rels\` (\`changelog_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_static_assets_id_idx\` ON \`payload_locked_documents_rels\` (\`static_assets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_seasons_id_idx\` ON \`payload_locked_documents_rels\` (\`seasons_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_competitors_id_idx\` ON \`payload_locked_documents_rels\` (\`competitors_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_brackets_id_idx\` ON \`payload_locked_documents_rels\` (\`brackets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_bracket_applications_id_idx\` ON \`payload_locked_documents_rels\` (\`bracket_applications_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_teams_id_idx\` ON \`payload_locked_documents_rels\` (\`teams_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_team_members_id_idx\` ON \`payload_locked_documents_rels\` (\`team_members_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_team_invites_id_idx\` ON \`payload_locked_documents_rels\` (\`team_invites_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_bracket_breaks_id_idx\` ON \`payload_locked_documents_rels\` (\`bracket_breaks_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_bracket_entries_id_idx\` ON \`payload_locked_documents_rels\` (\`bracket_entries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_matches_id_idx\` ON \`payload_locked_documents_rels\` (\`matches_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_match_results_id_idx\` ON \`payload_locked_documents_rels\` (\`match_results_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_registrations_id_idx\` ON \`payload_locked_documents_rels\` (\`registrations_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_preferences_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`users_id\` text,
	\`payload_mcp_api_keys_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`payload_mcp_api_keys_id\`) REFERENCES \`payload_mcp_api_keys\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_preferences_rels\`("id", "order", "parent_id", "path", "users_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "users_id", "payload_mcp_api_keys_id" FROM \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_preferences_rels\` RENAME TO \`payload_preferences_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_payload_mcp_api_keys_id_idx\` ON \`payload_preferences_rels\` (\`payload_mcp_api_keys_id\`);`)
  await db.run(sql`DROP INDEX \`articles_updated_at_idx\`;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`subtitle\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`type\` text;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`howto\` integer;`)
  await db.run(sql`ALTER TABLE \`articles\` ADD \`series_id\` text REFERENCES series(id);`)
  await db.run(sql`CREATE INDEX \`articles_series_idx\` ON \`articles\` (\`series_id\`);`)
  await db.run(sql`DROP INDEX \`_articles_v_version_version_updated_at_idx\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_subtitle\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_type\` text;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_howto\` integer;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` ADD \`version_series_id\` text REFERENCES series(id);`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_series_idx\` ON \`_articles_v\` (\`version_series_id\`);`)
  await db.run(sql`DROP INDEX \`courses_updated_at_idx\`;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`courses\` ADD \`difficulty\` text;`)
  await db.run(sql`DROP INDEX \`_courses_v_version_version_updated_at_idx\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` ADD \`version_difficulty\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`tagline\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`audio_file_size\` numeric;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`youtube_id\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`realtime_kit\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`podcast\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`subscribe_links\` text;`)
  await db.run(sql`ALTER TABLE \`videos\` ADD \`show_id\` text REFERENCES shows(id);`)
  await db.run(sql`CREATE INDEX \`videos_show_idx\` ON \`videos\` (\`show_id\`);`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_tagline\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_audio_file_size\` numeric;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_youtube_id\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_realtime_kit\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_podcast\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_subscribe_links\` text;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` ADD \`version_show_id\` text REFERENCES shows(id);`)
  await db.run(sql`CREATE INDEX \`_videos_v_version_version_show_idx\` ON \`_videos_v\` (\`version_show_id\`);`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`github\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`twitter\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`bluesky\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`mastodon\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`linkedin\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`website\` text;`)
  await db.run(sql`ALTER TABLE \`people\` ADD \`youtube\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_github\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_twitter\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_bluesky\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_mastodon\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_linkedin\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_website\` text;`)
  await db.run(sql`ALTER TABLE \`_people_v\` ADD \`version_youtube\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`seo\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`logos\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`license\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`cncf\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`community\` text;`)
  await db.run(sql`ALTER TABLE \`technologies\` ADD \`matrix\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_seo\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_logos\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_license\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_cncf\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_community\` text;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` ADD \`version_matrix\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`status\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`tagline\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`game_format_url\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_status\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_tagline\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_game_format_url\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`episodes\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`chapters\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules_rels\` ADD \`people_id\` text REFERENCES people(id);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_people_id_idx\` ON \`course_modules_rels\` (\`people_id\`);`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v_rels\` ADD \`people_id\` text REFERENCES people(id);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_people_id_idx\` ON \`_course_modules_v_rels\` (\`people_id\`);`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_path\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_format\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_data\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`body\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`cover\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths_rels\` ADD \`people_id\` text REFERENCES people(id);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_people_id_idx\` ON \`learning_paths_rels\` (\`people_id\`);`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_path\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_format\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_data\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_raw\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_source_assets\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_body\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_cover\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_content_resources\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_editorial_data\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v_rels\` ADD \`people_id\` text REFERENCES people(id);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_people_id_idx\` ON \`_learning_paths_v_rels\` (\`people_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // payload_mcp_api_keys and academy_settings predate this migration and are
  // intentionally preserved even though the optional MCP plugin is disabled.
  // D1 keeps foreign keys enabled. Dropping either parent table would cascade
  // relationship/array rows and null incoming video references, even if checks
  // were deferred. Remove only the columns introduced by up() in place.
  await db.run(sql`DROP INDEX \`videos_show_idx\`;`)
  await db.run(sql`DROP INDEX \`_videos_v_version_version_show_idx\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`tagline\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`audio_file_size\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`youtube_id\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`realtime_kit\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`podcast\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`subscribe_links\`;`)
  await db.run(sql`ALTER TABLE \`videos\` DROP COLUMN \`show_id\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_tagline\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_audio_file_size\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_youtube_id\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_realtime_kit\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_podcast\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_subscribe_links\`;`)
  await db.run(sql`ALTER TABLE \`_videos_v\` DROP COLUMN \`version_show_id\`;`)
  await db.run(sql`DROP INDEX \`articles_series_idx\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`subtitle\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`type\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`howto\`;`)
  await db.run(sql`ALTER TABLE \`articles\` DROP COLUMN \`series_id\`;`)
  await db.run(sql`CREATE INDEX \`articles_updated_at_idx\` ON \`articles\` (\`updated_at\`);`)
  await db.run(sql`DROP INDEX \`_articles_v_version_version_series_idx\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_subtitle\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_type\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_howto\`;`)
  await db.run(sql`ALTER TABLE \`_articles_v\` DROP COLUMN \`version_series_id\`;`)
  await db.run(sql`CREATE INDEX \`_articles_v_version_version_updated_at_idx\` ON \`_articles_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_course_modules_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` text NOT NULL,
	\`path\` text NOT NULL,
	\`learning_resources_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_course_modules_rels\`("id", "order", "parent_id", "path", "learning_resources_id") SELECT "id", "order", "parent_id", "path", "learning_resources_id" FROM \`course_modules_rels\`;`)
  await db.run(sql`DROP TABLE \`course_modules_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_course_modules_rels\` RENAME TO \`course_modules_rels\`;`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_order_idx\` ON \`course_modules_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_parent_idx\` ON \`course_modules_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_path_idx\` ON \`course_modules_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_rels_learning_resources_id_idx\` ON \`course_modules_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__course_modules_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`learning_resources_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_course_modules_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`learning_resources_id\`) REFERENCES \`learning_resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new__course_modules_v_rels\`("id", "order", "parent_id", "path", "learning_resources_id") SELECT "id", "order", "parent_id", "path", "learning_resources_id" FROM \`_course_modules_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_course_modules_v_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new__course_modules_v_rels\` RENAME TO \`_course_modules_v_rels\`;`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_order_idx\` ON \`_course_modules_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_parent_idx\` ON \`_course_modules_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_path_idx\` ON \`_course_modules_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_rels_learning_resources_id_idx\` ON \`_course_modules_v_rels\` (\`learning_resources_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_learning_paths_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` text NOT NULL,
	\`path\` text NOT NULL,
	\`courses_id\` text,
	\`videos_id\` text,
	\`technologies_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`learning_paths\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`courses_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`videos_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_learning_paths_rels\`("id", "order", "parent_id", "path", "courses_id", "videos_id", "technologies_id") SELECT "id", "order", "parent_id", "path", "courses_id", "videos_id", "technologies_id" FROM \`learning_paths_rels\`;`)
  await db.run(sql`DROP TABLE \`learning_paths_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_learning_paths_rels\` RENAME TO \`learning_paths_rels\`;`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_order_idx\` ON \`learning_paths_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_parent_idx\` ON \`learning_paths_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_path_idx\` ON \`learning_paths_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_courses_id_idx\` ON \`learning_paths_rels\` (\`courses_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_videos_id_idx\` ON \`learning_paths_rels\` (\`videos_id\`);`)
  await db.run(sql`CREATE INDEX \`learning_paths_rels_technologies_id_idx\` ON \`learning_paths_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`__new__learning_paths_v_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`courses_id\` text,
	\`videos_id\` text,
	\`technologies_id\` text,
	FOREIGN KEY (\`parent_id\`) REFERENCES \`_learning_paths_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`courses_id\`) REFERENCES \`courses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`videos_id\`) REFERENCES \`videos\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`technologies_id\`) REFERENCES \`technologies\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new__learning_paths_v_rels\`("id", "order", "parent_id", "path", "courses_id", "videos_id", "technologies_id") SELECT "id", "order", "parent_id", "path", "courses_id", "videos_id", "technologies_id" FROM \`_learning_paths_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_learning_paths_v_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new__learning_paths_v_rels\` RENAME TO \`_learning_paths_v_rels\`;`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_order_idx\` ON \`_learning_paths_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_parent_idx\` ON \`_learning_paths_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_path_idx\` ON \`_learning_paths_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_courses_id_idx\` ON \`_learning_paths_v_rels\` (\`courses_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_videos_id_idx\` ON \`_learning_paths_v_rels\` (\`videos_id\`);`)
  await db.run(sql`CREATE INDEX \`_learning_paths_v_rels_technologies_id_idx\` ON \`_learning_paths_v_rels\` (\`technologies_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`order\` integer,
	\`parent_id\` integer NOT NULL,
	\`path\` text NOT NULL,
	\`pipeline_runs_id\` text,
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
	FOREIGN KEY (\`pipeline_runs_id\`) REFERENCES \`pipeline_runs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
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
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "pipeline_runs_id", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id") SELECT "id", "order", "parent_id", "path", "pipeline_runs_id", "users_id", "deletion_markers_id", "videos_id", "people_id", "technologies_id", "shows_id", "episodes_id", "chapters_id", "learning_resources_id", "articles_id", "courses_id", "course_modules_id", "learning_paths_id", "media_id", "payload_mcp_api_keys_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pipeline_runs_id_idx\` ON \`payload_locked_documents_rels\` (\`pipeline_runs_id\`);`)
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
  await db.run(sql`CREATE INDEX \`courses_updated_at_idx\` ON \`courses\` (\`updated_at\`);`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`courses\` DROP COLUMN \`difficulty\`;`)
  await db.run(sql`CREATE INDEX \`_courses_v_version_version_updated_at_idx\` ON \`_courses_v\` (\`version_updated_at\`);`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_courses_v\` DROP COLUMN \`version_difficulty\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`github\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`twitter\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`bluesky\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`mastodon\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`linkedin\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`website\`;`)
  await db.run(sql`ALTER TABLE \`people\` DROP COLUMN \`youtube\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_github\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_twitter\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_bluesky\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_mastodon\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_linkedin\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_website\`;`)
  await db.run(sql`ALTER TABLE \`_people_v\` DROP COLUMN \`version_youtube\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`seo\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`logos\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`license\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`cncf\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`community\`;`)
  await db.run(sql`ALTER TABLE \`technologies\` DROP COLUMN \`matrix\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_seo\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_logos\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_license\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_cncf\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_community\`;`)
  await db.run(sql`ALTER TABLE \`_technologies_v\` DROP COLUMN \`version_matrix\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`status\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`tagline\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`game_format_url\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_status\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_tagline\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_game_format_url\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`episodes\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_episodes_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`chapters\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_chapters_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`learning_resources\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_learning_resources_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_path\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_format\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_data\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_raw\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`source_assets\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`body\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`cover\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`content_resources\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`editorial_data\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_path\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_format\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_data\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_raw\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_source_assets\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_body\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_cover\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_content_resources\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_editorial_data\`;`)
  // Remove the new tables only after their incoming references above have been
  // removed. Drop children before parents so D1 never sees a missing FK target.
  await db.run(sql`DROP TABLE \`_registrations_v\`;`)
  await db.run(sql`DROP TABLE \`registrations\`;`)
  await db.run(sql`DROP TABLE \`_match_results_v\`;`)
  await db.run(sql`DROP TABLE \`match_results\`;`)
  await db.run(sql`DROP TABLE \`_matches_v\`;`)
  await db.run(sql`DROP TABLE \`matches\`;`)
  await db.run(sql`DROP TABLE \`_bracket_entries_v\`;`)
  await db.run(sql`DROP TABLE \`bracket_entries\`;`)
  await db.run(sql`DROP TABLE \`_bracket_breaks_v\`;`)
  await db.run(sql`DROP TABLE \`bracket_breaks\`;`)
  await db.run(sql`DROP TABLE \`_team_invites_v\`;`)
  await db.run(sql`DROP TABLE \`team_invites\`;`)
  await db.run(sql`DROP TABLE \`_team_members_v\`;`)
  await db.run(sql`DROP TABLE \`team_members\`;`)
  await db.run(sql`DROP TABLE \`_teams_v\`;`)
  await db.run(sql`DROP TABLE \`teams\`;`)
  await db.run(sql`DROP TABLE \`_bracket_applications_v\`;`)
  await db.run(sql`DROP TABLE \`bracket_applications\`;`)
  await db.run(sql`DROP TABLE \`_brackets_v\`;`)
  await db.run(sql`DROP TABLE \`brackets\`;`)
  await db.run(sql`DROP TABLE \`_competitors_v\`;`)
  await db.run(sql`DROP TABLE \`competitors\`;`)
  await db.run(sql`DROP TABLE \`_seasons_v\`;`)
  await db.run(sql`DROP TABLE \`seasons\`;`)
  await db.run(sql`DROP TABLE \`_static_assets_v\`;`)
  await db.run(sql`DROP TABLE \`static_assets\`;`)
  await db.run(sql`DROP TABLE \`_changelog_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_changelog_v\`;`)
  await db.run(sql`DROP TABLE \`changelog_rels\`;`)
  await db.run(sql`DROP TABLE \`changelog\`;`)
  await db.run(sql`DROP TABLE \`_news_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_news_v\`;`)
  await db.run(sql`DROP TABLE \`news_rels\`;`)
  await db.run(sql`DROP TABLE \`news\`;`)
  await db.run(sql`DROP TABLE \`_testimonials_v\`;`)
  await db.run(sql`DROP TABLE \`testimonials\`;`)
  await db.run(sql`DROP TABLE \`_adrs_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_adrs_v\`;`)
  await db.run(sql`DROP TABLE \`adrs_rels\`;`)
  await db.run(sql`DROP TABLE \`adrs\`;`)
  await db.run(sql`DROP TABLE \`_series_v\`;`)
  await db.run(sql`DROP TABLE \`series\`;`)
  await db.run(sql`DROP TABLE \`_courses_v_version_learning_path\`;`)
  await db.run(sql`DROP TABLE \`courses_learning_path\`;`)
  await db.run(sql`DROP TABLE \`_videos_v_version_what_you_will_learn\`;`)
  await db.run(sql`DROP TABLE \`videos_what_you_will_learn\`;`)
}
