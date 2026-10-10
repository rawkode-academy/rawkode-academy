import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'

export const reviewThumbnailSchema = [
  `CREATE TABLE review_thumbnail_assets(media_id TEXT PRIMARY KEY NOT NULL REFERENCES media(id) ON DELETE RESTRICT, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, checksum TEXT NOT NULL CHECK(length(checksum)=64), object_key TEXT UNIQUE NOT NULL, object_etag TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=5242880), content_type TEXT NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')), UNIQUE(video_id,checksum))`,
  `CREATE TRIGGER review_thumbnail_identity BEFORE UPDATE ON review_thumbnail_assets BEGIN SELECT RAISE(ABORT,'Review thumbnails are immutable'); END`,
  `CREATE TRIGGER review_thumbnail_retention BEFORE DELETE ON review_thumbnail_assets BEGIN SELECT RAISE(ABORT,'Review thumbnails are retained'); END`,
]
export async function up({ db }: MigrateUpArgs) { for (const query of reviewThumbnailSchema) await db.run(sql.raw(query)) }
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'thumbnail-rollback',CASE WHEN EXISTS(SELECT 1 FROM review_thumbnail_assets) THEN 0 ELSE 1 END;`)
  await db.run(sql`DROP TRIGGER review_thumbnail_identity;`)
  await db.run(sql`DROP TRIGGER review_thumbnail_retention;`)
  await db.run(sql`DROP TABLE review_thumbnail_assets;`)
  await db.run(sql`DELETE FROM review_command_guards WHERE id='thumbnail-rollback';`)
}
