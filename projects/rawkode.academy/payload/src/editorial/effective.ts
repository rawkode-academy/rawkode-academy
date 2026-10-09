import { ReviewError } from '../review/contracts'

// The one effective rule for editorial times, shared by the staff read, review
// publish, the queue, the published contract and tests. Imported videos have no
// side-table row and read their git values, so importer replays keep flowing:
// - publishedAt: the first public release. The stored value wins; otherwise the
//   imported publishedAt of a video that is published in Payload.
// - scheduledStartAt: the stored value; otherwise the imported publishedAt of a
//   live video (git recorded a live video's stream time there).
// - broadcast times come only from the side table.
export type TimesRow = {
  id: number
  scheduled_start_at: string | null
  broadcast_started_at: string | null
  broadcast_ended_at: string | null
  published_at: string | null
  version: number
  source: 'backfill' | 'editorial' | 'studio' | 'review'
}
export type EditorialTimesV1 = { scheduledStartAt: string | null; broadcastStartedAt: string | null; broadcastEndedAt: string | null; publishedAt: string | null }
export type LegacyTimes = { type?: unknown; publishedAt?: unknown; _status?: unknown }
export const editorialFields = ['scheduledStartAt', 'broadcastStartedAt', 'broadcastEndedAt', 'publishedAt'] as const
export type EditorialField = (typeof editorialFields)[number]
export const editorialColumns: Record<EditorialField, keyof TimesRow> = {
  scheduledStartAt: 'scheduled_start_at',
  broadcastStartedAt: 'broadcast_started_at',
  broadcastEndedAt: 'broadcast_ended_at',
  publishedAt: 'published_at',
}

// Canonical 'YYYY-MM-DDTHH:MM:SS.sssZ', so text comparison in SQL orders by time.
export function canonicalTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : Number.NaN
  if (Number.isNaN(time)) throw new ReviewError(400, 'Invalid date')
  return new Date(time).toISOString()
}

// Legacy git values are trusted only when they parse; a malformed import never
// breaks a read surface.
function legacyTime(value: unknown) {
  try { return canonicalTime(value) } catch { return null }
}

export function effectiveTimes(row: Partial<Pick<TimesRow, 'scheduled_start_at' | 'broadcast_started_at' | 'broadcast_ended_at' | 'published_at'>> | null | undefined, legacy: LegacyTimes): EditorialTimesV1 {
  return {
    scheduledStartAt: row?.scheduled_start_at ?? (legacy.type === 'live' ? legacyTime(legacy.publishedAt) : null),
    broadcastStartedAt: row?.broadcast_started_at ?? null,
    broadcastEndedAt: row?.broadcast_ended_at ?? null,
    publishedAt: row?.published_at ?? (legacy._status === 'published' ? legacyTime(legacy.publishedAt) : null),
  }
}
