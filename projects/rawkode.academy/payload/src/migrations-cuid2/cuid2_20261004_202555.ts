import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`course_modules_learning_path\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` text NOT NULL,
	\`id\` text PRIMARY KEY NOT NULL,
	\`value\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`course_modules\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`course_modules_learning_path_order_idx\` ON \`course_modules_learning_path\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`course_modules_learning_path_parent_id_idx\` ON \`course_modules_learning_path\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_course_modules_v_version_learning_path\` (
	\`_order\` integer NOT NULL,
	\`_parent_id\` integer NOT NULL,
	\`id\` integer PRIMARY KEY NOT NULL,
	\`value\` text,
	\`_uuid\` text,
	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_course_modules_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_learning_path_order_idx\` ON \`_course_modules_v_version_learning_path\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_course_modules_v_version_learning_path_parent_id_idx\` ON \`_course_modules_v_version_learning_path\` (\`_parent_id\`);`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`podcast\` text;`)
  await db.run(sql`ALTER TABLE \`shows\` ADD \`subscribe_links\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_podcast\` text;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` ADD \`version_subscribe_links\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`published_at\` text;`)
  await db.run(sql`ALTER TABLE \`course_modules\` ADD \`difficulty\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_published_at\` text;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` ADD \`version_difficulty\` text;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` ADD \`published_at\` text;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` ADD \`version_published_at\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`course_modules_learning_path\`;`)
  await db.run(sql`DROP TABLE \`_course_modules_v_version_learning_path\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`podcast\`;`)
  await db.run(sql`ALTER TABLE \`shows\` DROP COLUMN \`subscribe_links\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_podcast\`;`)
  await db.run(sql`ALTER TABLE \`_shows_v\` DROP COLUMN \`version_subscribe_links\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`published_at\`;`)
  await db.run(sql`ALTER TABLE \`course_modules\` DROP COLUMN \`difficulty\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_published_at\`;`)
  await db.run(sql`ALTER TABLE \`_course_modules_v\` DROP COLUMN \`version_difficulty\`;`)
  await db.run(sql`ALTER TABLE \`learning_paths\` DROP COLUMN \`published_at\`;`)
  await db.run(sql`ALTER TABLE \`_learning_paths_v\` DROP COLUMN \`version_published_at\`;`)
}
