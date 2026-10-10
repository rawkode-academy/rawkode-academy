import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'
export const reviewJobSchema = [
  `CREATE TABLE review_processing_jobs(session_id TEXT PRIMARY KEY NOT NULL REFERENCES review_upload_sessions(id) ON DELETE RESTRICT, manifest TEXT NOT NULL, result TEXT, completed_at INTEGER)`,
  `CREATE TRIGGER review_job_identity BEFORE UPDATE ON review_processing_jobs WHEN NEW.session_id!=OLD.session_id OR NEW.manifest!=OLD.manifest OR OLD.result IS NOT NULL OR NEW.result IS NULL OR NEW.completed_at IS NULL BEGIN SELECT RAISE(ABORT,'Processing identity and completed result are immutable'); END`,
  `CREATE TRIGGER review_job_retention BEFORE DELETE ON review_processing_jobs BEGIN SELECT RAISE(ABORT,'Processing jobs are retained'); END`,
]
export async function up({ db }: MigrateUpArgs) { for (const query of reviewJobSchema) await db.run(sql.raw(query)) }
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`INSERT INTO review_command_guards(id,valid) SELECT 'job-rollback',CASE WHEN EXISTS(SELECT 1 FROM review_processing_jobs) THEN 0 ELSE 1 END;`)
  await db.run(sql`DROP TRIGGER review_job_identity;`)
  await db.run(sql`DROP TRIGGER review_job_retention;`)
  await db.run(sql`DROP TABLE review_processing_jobs;`)
  await db.run(sql`DELETE FROM review_command_guards WHERE id='job-rollback';`)
}
