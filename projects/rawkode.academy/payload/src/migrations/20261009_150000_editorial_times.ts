import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-d1-sqlite'

// Editorial times (scheduledStartAt, broadcastStartedAt, broadcastEndedAt,
// publishedAt) and staff review assignments. Internal tables outside Payload
// collection CRUD and snapshots, like the other review tables: the review freeze
// triggers refuse every write to videos for a reviewed video, so the times live
// in a side table written only by guarded, journaled commands (src/editorial).
//
// No import backfill: imported videos keep reading their git publishedAt through
// the read-time fallback in src/editorial/effective.ts, so importer replays keep
// flowing to every read surface. Only reviewed videos whose first public release
// exists solely in review_publication_events get a 'backfill' row.
// Every timestamp is canonical 'YYYY-MM-DDTHH:MM:SS.sssZ', so text order is time order.
export const editorialSchema = [
  `CREATE TABLE video_editorial_times (id INTEGER PRIMARY KEY NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, scheduled_start_at TEXT, broadcast_started_at TEXT, broadcast_ended_at TEXT, published_at TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), source TEXT NOT NULL CHECK(source IN ('backfill','editorial','studio','review')), CHECK(broadcast_ended_at IS NULL OR (broadcast_started_at IS NOT NULL AND broadcast_ended_at>=broadcast_started_at)))`,
  `CREATE TABLE editorial_time_events (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, action TEXT NOT NULL, actor TEXT NOT NULL, field TEXT NOT NULL, previous TEXT, next TEXT, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE INDEX editorial_time_events_video_idx ON editorial_time_events(video_id)`,
  `CREATE TRIGGER editorial_time_events_update BEFORE UPDATE ON editorial_time_events BEGIN SELECT RAISE(ABORT,'Editorial time history is immutable'); END`,
  `CREATE TRIGGER editorial_time_events_delete BEFORE DELETE ON editorial_time_events BEGIN SELECT RAISE(ABORT,'Editorial time history is immutable'); END`,
  // The idempotency journal. actor is text ('user:<id>' or 'machine:studio')
  // because review_commands.actor_id must name a users row.
  `CREATE TABLE editorial_commands (id TEXT PRIMARY KEY NOT NULL, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE RESTRICT, actor TEXT NOT NULL, input_hash TEXT NOT NULL, result TEXT NOT NULL)`,
  `CREATE TABLE review_assignments (video_id INTEGER PRIMARY KEY NOT NULL REFERENCES video_review_state(video_id) ON DELETE RESTRICT, assignee_id INTEGER REFERENCES users(id) ON DELETE RESTRICT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), assigned_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, assigned_at TEXT NOT NULL)`,
  `CREATE INDEX review_assignments_assignee_idx ON review_assignments(assignee_id)`,
  // Reviewed videos whose first public release exists only in review history. This
  // never touches videos, so the freeze triggers do not fire.
  `INSERT INTO video_editorial_times(id,published_at,source)
    SELECT e.video_id,strftime('%Y-%m-%dT%H:%M:%fZ',MIN(e.published_at)),'backfill'
    FROM review_publication_events e JOIN videos v ON v.id=e.video_id
    WHERE NOT (v._status='published' AND v.published_at IS NOT NULL)
    GROUP BY e.video_id`,
  // Projections now carry the first public release, so compat GraphQL and the
  // published contract report one value.
  `UPDATE video_publications SET document=json_set(document,'$.publishedAt',COALESCE(
    (SELECT published_at FROM video_editorial_times t WHERE t.id=video_publications.id),
    (SELECT strftime('%Y-%m-%dT%H:%M:%fZ',v.published_at) FROM videos v WHERE v.id=video_publications.id AND v._status='published' AND v.published_at IS NOT NULL),
    json_extract(document,'$.publishedAt')))`,
]
export const editorialTriggers = ['editorial_time_events_update', 'editorial_time_events_delete']
export async function up({ db }: MigrateUpArgs) { for (const statement of editorialSchema) await db.run(sql.raw(statement)) }
export async function down({ db }: MigrateDownArgs) {
  // Refuses once real editorial data exists: only backfill rows may be discarded.
  // D1 runs these statements without a transaction, so the guard row is removed as
  // soon as the check passes and a failed rollback can be retried.
  const guard = `rollback-editorial-${crypto.randomUUID()}`
  await db.run(sql.raw(`INSERT INTO review_command_guards(id,valid) SELECT '${guard}',CASE WHEN EXISTS(SELECT 1 FROM video_editorial_times WHERE source<>'backfill') OR EXISTS(SELECT 1 FROM editorial_time_events) OR EXISTS(SELECT 1 FROM editorial_commands) OR EXISTS(SELECT 1 FROM review_assignments) THEN 0 ELSE 1 END;`))
  await db.run(sql.raw(`DELETE FROM review_command_guards WHERE id='${guard}';`))
  // Before this migration a projection always held its latest publish time.
  await db.run(sql`UPDATE video_publications SET document=json_set(document,'$.publishedAt',(SELECT MAX(published_at) FROM review_publication_events e WHERE e.video_id=video_publications.id)) WHERE EXISTS(SELECT 1 FROM review_publication_events e WHERE e.video_id=video_publications.id);`)
  for (const name of editorialTriggers) await db.run(sql.raw(`DROP TRIGGER IF EXISTS ${name}`))
  for (const name of ['review_assignments_assignee_idx', 'editorial_time_events_video_idx']) await db.run(sql.raw(`DROP INDEX IF EXISTS ${name}`))
  for (const table of ['review_assignments', 'editorial_commands', 'editorial_time_events', 'video_editorial_times']) await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`))
}
