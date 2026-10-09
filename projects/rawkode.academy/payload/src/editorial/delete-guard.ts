import { APIError } from 'payload'

// Payload deletes without a transaction: beforeDelete (the deletion marker), then
// the versions, then the row. When a review or editorial row holds an FK RESTRICT
// on the video, or a review freeze trigger fires, the final delete aborts and the
// deletion marker is left behind. This guard runs first and refuses up front.
const managedSql = `SELECT 1 AS managed WHERE EXISTS(SELECT 1 FROM video_review_state WHERE video_id=?1)
  OR EXISTS(SELECT 1 FROM video_editorial_times WHERE id=?1)
  OR EXISTS(SELECT 1 FROM editorial_time_events WHERE video_id=?1)
  OR EXISTS(SELECT 1 FROM editorial_commands WHERE video_id=?1)
  OR EXISTS(SELECT 1 FROM review_upload_sessions WHERE video_id=?1)
  OR EXISTS(SELECT 1 FROM review_studio_adoptions WHERE video_id=?1)`

export const videoDeleteGuard = (db: Pick<D1Database, 'prepare'>) => async ({ id }: { id: string | number }) => {
  if (await db.prepare(managedSql).bind(Number(id)).first()) throw new APIError('Managed video: tombstone it instead of deleting', 409)
}
