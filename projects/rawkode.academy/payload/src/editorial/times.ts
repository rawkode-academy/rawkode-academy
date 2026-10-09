import { ReviewError } from '../review/contracts'
import type { ReviewStore, Statement } from '../review/store'
import { actorName, editorialCommandSchema, type EditorialActor, type EditorialCommand } from './contracts'
import { canonicalTime, editorialColumns, effectiveTimes, type EditorialField, type EditorialTimesV1, type TimesRow } from './effective'

type Video = { id: number; legacyId: string; type: string | null; _status: string | null; publishedAt: string | null }
type Stored = Pick<TimesRow, 'scheduled_start_at' | 'broadcast_started_at' | 'broadcast_ended_at' | 'published_at'>
export type EditorialEvent = { id: string; action: string; actor: string; field: string; previous: string | null; next: string | null; note: string; createdAt: string }
export type EditorialRead = {
  videoId: number
  legacyId: string
  type: string | null
  stored: EditorialTimesV1 | null
  effective: EditorialTimesV1
  version: number
  source: TimesRow['source'] | null
  history: EditorialEvent[]
}
export type EditorialResult = { id: string; action: EditorialCommand['action']; videoId: number; legacyId: string; version: number; changed: EditorialField[]; times: EditorialTimesV1 }

// A broadcast-started or -ended time must be recent: a clock this far ahead or
// behind is a bug or a replay, never a real stream.
export const broadcastPastMs = 24 * 3600 * 1000
export const broadcastFutureMs = 120 * 1000
const machineAttempts = 3
class FenceConflict extends Error {}
const empty: Stored = { scheduled_start_at: null, broadcast_started_at: null, broadcast_ended_at: null, published_at: null }
const statement = (sql: string, ...values: Statement['values']): Statement => ({ sql, values })
const stored = (row: Stored): EditorialTimesV1 => ({ scheduledStartAt: row.scheduled_start_at, broadcastStartedAt: row.broadcast_started_at, broadcastEndedAt: row.broadcast_ended_at, publishedAt: row.published_at })
async function hash(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Guarded, idempotent, journaled writes to video_editorial_times. Follows the
// ReviewStore pattern (guard row with CHECK(valid=1), a version fence and a
// command journal) but never uses ReviewStore.commit: commit is keyed to
// video_review_state.generation, and upcoming streams have no review state.
// The side table is outside the review freeze, so reviewed videos accept writes.
export class EditorialTimes {
  constructor(readonly store: ReviewStore, readonly now: () => number = () => Date.now()) {}

  private async video(where: { videoId?: number; legacyId?: string }) {
    const video = where.legacyId !== undefined
      ? await this.store.one<Video>('SELECT id,legacy_id AS legacyId,type,_status,published_at AS publishedAt FROM videos WHERE legacy_id=? AND tombstone=0', where.legacyId)
      : await this.store.one<Video>('SELECT id,legacy_id AS legacyId,type,_status,published_at AS publishedAt FROM videos WHERE id=? AND tombstone=0', where.videoId!)
    if (!video) throw new ReviewError(404, 'Video not found')
    return video
  }
  private row(videoId: number) { return this.store.one<TimesRow>('SELECT * FROM video_editorial_times WHERE id=?', videoId) }

  async read(videoId: number): Promise<EditorialRead> {
    const video = await this.video({ videoId })
    const [row, history] = await Promise.all([
      this.row(videoId),
      this.store.all<EditorialEvent>('SELECT id,action,actor,field,previous,next,note,created_at AS createdAt FROM editorial_time_events WHERE video_id=? ORDER BY created_at DESC,id DESC LIMIT 20', videoId),
    ])
    return { videoId, legacyId: video.legacyId, type: video.type, stored: row ? stored(row) : null, effective: effectiveTimes(row, video), version: row?.version ?? 0, source: row?.source ?? null, history }
  }

  async execute(actor: EditorialActor, value: unknown): Promise<EditorialResult> {
    const parsed = editorialCommandSchema.safeParse(value)
    if (!parsed.success) throw new ReviewError(400, 'Invalid editorial command')
    const input = parsed.data
    const machine = input.action === 'broadcast-started' || input.action === 'broadcast-ended'
    if (actor.kind === 'user' && actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
    if (actor.kind === 'machine' && !machine) throw new ReviewError(403, 'Staff access required')
    const video = await this.video(input)
    const inputHash = await hash(input)
    const name = actorName(actor)
    // Studio's broadcast commands are not fenced on a caller version, so a race with
    // a staff edit or a publish is retried here against the new row. A conflict
    // that survives the retries is a 503 for the machine (its outbox retries) and
    // a 409 for staff (reload).
    for (let attempt = 1; ; attempt++) {
      const replay = await this.replay(input.commandId, video.id, name, inputHash)
      if (replay) return replay
      if (attempt > 1 && actor.kind !== 'machine') throw new ReviewError(409, 'Editorial times changed or command already completed; reload and retry')
      if (attempt > machineAttempts) throw new ReviewError(503, 'Editorial times are busy; retry')
      try {
        return await this.attempt(actor, input, video, name, inputHash)
      } catch (error) {
        if (!(error instanceof FenceConflict)) throw error
      }
    }
  }

  private async replay(commandId: string, videoId: number, name: string, inputHash: string): Promise<EditorialResult | null> {
    const prior = await this.store.one<{ video_id: number; actor: string; input_hash: string; result: string }>('SELECT * FROM editorial_commands WHERE id=?', commandId)
    if (!prior) return null
    if (prior.video_id !== videoId || prior.actor !== name || prior.input_hash !== inputHash) throw new ReviewError(409, 'Command ID was used for another request')
    return JSON.parse(prior.result)
  }

  private async attempt(actor: EditorialActor, input: EditorialCommand, video: Video, name: string, inputHash: string): Promise<EditorialResult> {
    const current = await this.row(video.id)
    const version = current?.version ?? 0
    const before: Stored = current ?? empty
    const next: Stored = { ...before }
    const now = this.now()
    let note = ''
    if (input.action === 'schedule' || input.action === 'correct') {
      if (version !== input.expectedVersion) throw new ReviewError(409, 'Editorial times changed elsewhere; reload and retry')
    }
    if (input.action === 'schedule') {
      if (before.broadcast_started_at) throw new ReviewError(409, 'The broadcast already started; correct the times instead')
      next.scheduled_start_at = canonicalTime(input.scheduledStartAt)
    } else if (input.action === 'correct') {
      note = input.note
      for (const field of ['scheduledStartAt', 'broadcastStartedAt', 'broadcastEndedAt'] as const) {
        if (input.fields[field] !== undefined) next[editorialColumns[field] as keyof Stored] = canonicalTime(input.fields[field])
      }
      if (next.broadcast_ended_at && (!next.broadcast_started_at || next.broadcast_ended_at < next.broadcast_started_at)) throw new ReviewError(400, 'A broadcast must start before it ends')
    } else {
      // A leaked or confused caller can never mark a recorded video live.
      if (video.type !== 'live') throw new ReviewError(409, 'Only live videos have broadcast times')
      const at = canonicalTime(input.at)!
      if (Date.parse(at) > now + broadcastFutureMs) throw new ReviewError(400, 'Broadcast time is in the future')
      if (input.action === 'broadcast-started') {
        // No schedule is required: live shows may start ad hoc.
        if (Date.parse(at) < now - broadcastPastMs) throw new ReviewError(400, 'Broadcast time is too old')
        if (before.broadcast_started_at && before.broadcast_started_at !== at) {
          // A stream stopped and started again on the same Studio session: the show
          // is live again. The first start stays; the earlier end is cleared.
          if (!before.broadcast_ended_at || at < before.broadcast_ended_at) throw new ReviewError(409, 'The broadcast already started; staff correct the times')
          note = 'Broadcast restarted'
          next.broadcast_ended_at = null
        } else {
          next.broadcast_started_at = at
        }
      } else {
        if (!before.broadcast_started_at) throw new ReviewError(409, 'The broadcast has not started')
        if (at < before.broadcast_started_at) throw new ReviewError(400, 'A broadcast must start before it ends')
        if (before.broadcast_ended_at && before.broadcast_ended_at !== at) throw new ReviewError(409, 'The broadcast already ended; staff correct the times')
        next.broadcast_ended_at = at
      }
    }
    const changed = (['scheduledStartAt', 'broadcastStartedAt', 'broadcastEndedAt'] as const).filter(field => {
      const column = editorialColumns[field] as keyof Stored
      return next[column] !== before[column]
    })
    const nextVersion = changed.length ? version + 1 : version
    const result: EditorialResult = { id: input.commandId, action: input.action, videoId: video.id, legacyId: video.legacyId, version: nextVersion, changed, times: effectiveTimes(changed.length || current ? next : null, video) }
    const at = new Date(now).toISOString()
    const guard = crypto.randomUUID()
    const batch: Statement[] = [
      statement('INSERT INTO review_command_guards(id,valid) SELECT ?,CASE WHEN COALESCE((SELECT version FROM video_editorial_times WHERE id=?),0)=? AND EXISTS(SELECT 1 FROM videos WHERE id=? AND tombstone=0) THEN 1 ELSE 0 END', guard, video.id, version, video.id),
    ]
    if (changed.length) {
      const columns = changed.map(field => editorialColumns[field])
      // SQLite checks CHECK constraints on the candidate row before ON CONFLICT, so
      // the insert carries the whole merged row; the update sets only what changed.
      batch.push(statement(
        `INSERT INTO video_editorial_times(id,scheduled_start_at,broadcast_started_at,broadcast_ended_at,published_at,source) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ${columns.map(column => `${column}=excluded.${column}`).join(',')},version=video_editorial_times.version+1,source=excluded.source`,
        video.id, next.scheduled_start_at, next.broadcast_started_at, next.broadcast_ended_at, next.published_at, actor.kind === 'machine' ? 'studio' : 'editorial'))
      for (const field of changed) {
        const column = editorialColumns[field] as keyof Stored
        batch.push(statement('INSERT INTO editorial_time_events(id,video_id,action,actor,field,previous,next,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)', `${input.commandId}:${field}`, video.id, input.action, name, field, before[column], next[column], note, at))
      }
    }
    batch.push(
      statement('INSERT INTO editorial_commands(id,video_id,actor,input_hash,result) VALUES(?,?,?,?,?)', input.commandId, video.id, name, inputHash, JSON.stringify(result)),
      statement('DELETE FROM review_command_guards WHERE id=?', guard),
    )
    try {
      await this.store.db.batch(batch.map(item => this.store.db.prepare(item.sql).bind(...item.values)))
    } catch (error) {
      if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error))) throw new FenceConflict()
      throw error
    }
    return result
  }
}
