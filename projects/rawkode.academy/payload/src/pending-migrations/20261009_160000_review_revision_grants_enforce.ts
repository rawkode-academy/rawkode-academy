import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'
import { decisionBackfill, decisionUpdateTrigger } from '../migrations-cuid2/cuid2_20261009_130000_review_revision_grants'

// CONTRACT step of the revision grant rollout. It lives outside both migration
// directories on purpose: `payload migrate` runs every file in the selected
// directory whether or not index.ts lists it. Move it into the selected chain
// and register it only after the production traffic cutover is approved.
export const decisionPinTrigger = `CREATE TRIGGER review_decision_pin BEFORE INSERT ON review_decisions WHEN NEW.deliverable_checksum IS NOT (SELECT deliverable_checksum FROM video_revisions WHERE id=NEW.revision_id) OR NEW.source_checksum IS NOT (SELECT checksum FROM video_revisions WHERE id=NEW.revision_id) OR NEW.grant_id IS NULL OR NOT EXISTS(SELECT 1 FROM review_revision_grants WHERE id=NEW.grant_id AND revision_id=NEW.revision_id AND user_id=NEW.author_id AND version=NEW.grant_version AND can_approve=1 AND revoked_at IS NULL) BEGIN SELECT RAISE(ABORT,'Decision must pin the revision bytes and grant'); END`
export const retireLegacySchema = ['INSERT', 'UPDATE', 'DELETE'].map(operation => `CREATE TRIGGER video_review_grants_retired_${operation.toLowerCase()} BEFORE ${operation} ON video_review_grants BEGIN SELECT RAISE(ABORT,'Use revision grants'); END`)
// Clean up triggers from an earlier preview schema. New migrations never create
// them: SQLite cannot call the canonical CUID2 generator from a trigger.
const legacyMirrorTriggerNames = ['video_review_grants_mirror_insert', 'video_review_grants_mirror_update', 'video_review_grants_mirror_revoke', 'review_revision_grants_mirror_revoke']

export async function up({ db }: MigrateUpArgs) {
  for (const name of legacyMirrorTriggerNames) await db.run(sql.raw(`DROP TRIGGER IF EXISTS ${name}`))
  for (const query of [
    // Decisions recorded before the contract migration. Keep adjacent.
    'DROP TRIGGER review_decision_update',
    decisionBackfill(' WHERE deliverable_checksum IS NULL'),
    decisionUpdateTrigger,
    decisionPinTrigger,
    ...retireLegacySchema,
  ]) await db.run(sql.raw(query))
}
export async function down({ db }: MigrateDownArgs) {
  await db.run(sql`DROP TRIGGER review_decision_pin;`)
  for (const operation of ['insert', 'update', 'delete']) await db.run(sql.raw(`DROP TRIGGER video_review_grants_retired_${operation}`))
}
