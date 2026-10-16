import { ReviewError, type ReviewActor } from './contracts'
import type { ReviewService } from './service'
import type { ReviewStore, Statement } from './store'
import type { ReadOnlyBucket } from './studio-content'
import { adoptCommand, assertStudioPaths, clampMetadata, normalizeEtag, parseTranscodeStatus, statusQuery, studioPublicStreamUrl, type AdoptCommand, type ReviewDeliverable } from './studio-contracts'

export type StudioAdoption = { id: string; idempotency_key: string; input_hash: string; video_id: number; legacy_video_id: string; studio_session_id: string; recording_id: string; source_bucket: string; source_key: string; source_etag: string; source_bytes: number; source_format: AdoptCommand['source']['format']; review_prefix: string; metadata: string; requested_by: string | null; actor_id: number; revision_command: string; expected_current_revision: string | null; state: 'awaiting-transcode' | 'failed' | 'attached'; status_etag: string | null; revision_id: string | null; error: string | null; created_at: number; updated_at: number }
export type StudioAsset = { media_id: number; adoption_id: string; video_id: number; kind: 'source' | 'deliverable'; bucket: string; object_key: string; object_etag: string; checksum: string; bytes: number; content_type: string; duration_ms: number | null }
export type StudioVideo = { id: number; legacyId: string; title?: unknown; description?: unknown }
export type StudioAdoptionSummary = { adoptionId: string; idempotencyKey: string; videoId: number; legacyVideoId: string; state: StudioAdoption['state']; revisionId: string | null; error: string | null; publication: { publicationId: string; publishedAt: string } | null }

// The transcoder's Cloud Run task timeout is 3 hours. A queued or running status
// with no terminal update an hour past that was killed from outside (timeout, OOM,
// a container that never started) and is reported as failed, so Studio retriggers.
export const studioTranscodeStallMs = 4 * 60 * 60 * 1000
function statusStartedAt(document: Record<string, unknown>, uploaded: Date | undefined) {
  for (const field of ['startedAt', 'queuedAt']) {
    const value = document[field]
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return Date.parse(value)
  }
  return uploaded instanceof Date ? uploaded.getTime() : null
}
const statement = (sql: string, ...values: Statement['values']): Statement => ({ sql, values })
const sourceTypes: Record<StudioAdoption['source_format'], string> = { webm: 'video/webm', mkv: 'video/x-matroska', mp4: 'video/mp4' }
async function hash(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function studioSourceChecksum(etag: string) { return `r2-etag:${normalizeEtag(etag)}` }

// TrustedAssets semantics (intake-storage.ts) for objects adopted in place. Multipart
// Studio objects carry no stored sha256, so integrity is the pinned etag and size
// (plus content type for the deliverable); the deliverable digest is the
// transcoder's attestation, recorded at adoption.
export class StudioAssets {
  constructor(readonly store: ReviewStore, readonly content: ReadOnlyBucket) {}
  find(mediaId: number) { return this.store.one<StudioAsset>('SELECT * FROM review_studio_assets WHERE media_id=?', mediaId) }
  findByObject(key: string, etag: string) { return this.store.one<StudioAsset>('SELECT * FROM review_studio_assets WHERE object_key=? AND object_etag=?', key, etag) }
  async verify(asset: StudioAsset) {
    const head = await this.content.head(asset.object_key)
    if (!head || normalizeEtag(head.etag) !== normalizeEtag(asset.object_etag) || head.size !== asset.bytes || (asset.kind === 'deliverable' && head.httpMetadata?.contentType !== asset.content_type)) throw new ReviewError(409, 'Studio media object changed or is missing')
    return asset
  }
  async resolve(mediaId: number, videoId: number, kind: StudioAsset['kind']) {
    const asset = await this.find(mediaId)
    if (!asset) return null
    if (asset.video_id !== videoId || asset.kind !== kind) throw new ReviewError(409, 'Media is bound to another video or purpose')
    return this.verify(asset)
  }
  // True when the pair is a verified Studio pair; false when neither id is a Studio asset.
  async pair(videoId: number, sourceId: number, deliverableId: number) {
    const [source, deliverable] = await Promise.all([this.find(sourceId), this.find(deliverableId)])
    if (!source && !deliverable) return false
    if (!source || !deliverable || source.kind !== 'source' || deliverable.kind !== 'deliverable' || source.video_id !== videoId || deliverable.video_id !== videoId || source.adoption_id !== deliverable.adoption_id) throw new ReviewError(409, 'Deliverable does not belong to this exact Studio recording')
    return true
  }
}

// ReviewDependencies.stageRelease for a Studio deliverable. The approved review.mp4
// stays private: the publication points at the HLS that Studio's promotion produces
// on the content CDN, never at this Worker's origin.
export async function studioStageRelease(studioAssets: StudioAssets, videoId: number, mediaId: number, checksum: string) {
  const studio = await studioAssets.resolve(mediaId, videoId, 'deliverable')
  if (!studio) return null
  if (studio.checksum !== checksum) throw new ReviewError(409, 'Deliverable changed since approval')
  const adoption = await studioAssets.store.one<{ legacy_video_id: string }>('SELECT legacy_video_id FROM review_studio_adoptions WHERE id=?', studio.adoption_id)
  if (!adoption) throw new ReviewError(409, 'Studio adoption is missing')
  return { key: studio.object_key, etag: studio.object_etag, checksum: studio.checksum, bytes: studio.bytes, contentType: studio.content_type, publicUrl: studioPublicStreamUrl(adoption.legacy_video_id) }
}
export async function isStudioPublication(store: ReviewStore, objectKey: string, objectEtag: string) {
  return Boolean(await store.one('SELECT media_id FROM review_studio_assets WHERE object_key=? AND object_etag=?', objectKey, objectEtag))
}

export class StudioHandoff {
  constructor(
    readonly store: ReviewStore,
    readonly content: ReadOnlyBucket,
    readonly review: ReviewService,
    readonly resolveVideo: (legacyId: string, actor: ReviewActor) => Promise<StudioVideo>,
    readonly actor: ReviewActor,
    readonly bucketName: string,
    readonly now: () => number = () => Date.now(),
  ) {}
  private async batch(statements: Statement[]) { await this.store.db.batch(statements.map(s => this.store.db.prepare(s.sql).bind(...s.values))) }
  private byKey(key: string) { return this.store.one<StudioAdoption>('SELECT * FROM review_studio_adoptions WHERE idempotency_key=?', key) }
  private byId(id: string) { return this.store.one<StudioAdoption>('SELECT * FROM review_studio_adoptions WHERE id=?', id) }
  private async reload(row: StudioAdoption) { return (await this.byId(row.id))! }
  private async summary(row: StudioAdoption): Promise<StudioAdoptionSummary> {
    const publication = row.revision_id ? await this.store.one<{ publicationId: string; publishedAt: string }>('SELECT id AS publicationId,published_at AS publishedAt FROM review_publication_events WHERE revision_id=? ORDER BY published_at DESC,id DESC LIMIT 1', row.revision_id) : null
    return { adoptionId: row.id, idempotencyKey: row.idempotency_key, videoId: row.video_id, legacyVideoId: row.legacy_video_id, state: row.state, revisionId: row.revision_id, error: row.error, publication: publication ?? null }
  }
  // Non-terminal states only: 'attached' is final, enforced again by a trigger.
  private async setState(row: StudioAdoption, state: 'awaiting-transcode' | 'failed', statusEtag: string | null, error: string | null) {
    await this.batch([statement("UPDATE review_studio_adoptions SET state=?,status_etag=?,error=?,updated_at=? WHERE id=? AND state<>'attached'", state, statusEtag, error, this.now(), row.id)])
    return this.reload(row)
  }

  async adopt(value: unknown) {
    const parsed = adoptCommand.safeParse(value)
    if (!parsed.success) throw new ReviewError(400, 'Invalid Studio adoption command')
    const command = parsed.data
    assertStudioPaths(command, this.bucketName)
    const inputHash = await hash(command)
    const existing = await this.byKey(command.idempotencyKey)
    if (existing) {
      if (existing.input_hash !== inputHash) throw new ReviewError(409, 'Idempotency key reused')
      return this.progress(existing)
    }
    const head = await this.content.head(command.source.key)
    if (!head || normalizeEtag(head.etag) !== normalizeEtag(command.source.etag) || head.size !== command.source.bytes) throw new ReviewError(409, 'Studio source changed')
    const video = await this.resolveVideo(command.legacyVideoId, this.actor)
    const at = this.now()
    await this.batch([statement(
      'INSERT INTO review_studio_adoptions(id,idempotency_key,input_hash,video_id,legacy_video_id,studio_session_id,recording_id,source_bucket,source_key,source_etag,source_bytes,source_format,review_prefix,metadata,requested_by,actor_id,revision_command,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
      crypto.randomUUID(), command.idempotencyKey, inputHash, video.id, command.legacyVideoId, command.studioSessionId, command.recordingId, command.source.bucket, command.source.key, normalizeEtag(command.source.etag), command.source.bytes, command.source.format, command.reviewPrefix,
      JSON.stringify(clampMetadata(video, command, command.recordingId)), command.requestedBy ? JSON.stringify(command.requestedBy) : null, this.actor.id, crypto.randomUUID(), 'awaiting-transcode', at, at,
    )])
    const row = await this.byKey(command.idempotencyKey)
    if (!row) {
      // Studio gives every take a fresh recordingId and refuses re-marks, so this is unreachable from Studio.
      if (await this.store.one('SELECT id FROM review_studio_adoptions WHERE source_key=? OR review_prefix=?', command.source.key, command.reviewPrefix)) throw new ReviewError(409, 'Studio source already adopted')
      throw new ReviewError(409, 'Studio adoption could not be recorded; retry')
    }
    if (row.input_hash !== inputHash) throw new ReviewError(409, 'Idempotency key reused')
    return this.progress(row)
  }

  async status(query: unknown) {
    const parsed = statusQuery.safeParse(query)
    if (!parsed.success) throw new ReviewError(400, 'An adoptionId or idempotencyKey is required')
    const row = 'adoptionId' in parsed.data ? await this.byId(parsed.data.adoptionId) : await this.byKey(parsed.data.idempotencyKey)
    if (!row) throw new ReviewError(404, 'Studio adoption not found')
    return this.progress(row)
  }

  // Every call re-reads transcode-status.json. 'failed' never latches: an ingest
  // queue retry or a Studio retrigger that rewrites the status recovers the row.
  // A stalled queued/running status reads as failed, so Studio's retrigger runs.
  async progress(row: StudioAdoption): Promise<StudioAdoptionSummary> {
    if (row.state === 'attached') return this.summary(row)
    const object = await this.content.get(`${row.review_prefix}transcode-status.json`)
    if (!object || !('json' in object)) return this.summary(await this.setState(row, 'awaiting-transcode', null, null))
    const statusEtag = normalizeEtag(object.etag)
    let document: ReturnType<typeof parseTranscodeStatus>
    try { document = parseTranscodeStatus(await object.json().catch(() => null), row) }
    catch (error) {
      if (!(error instanceof ReviewError)) throw error
      return this.summary(await this.setState(row, 'failed', statusEtag, error.message))
    }
    if (document.status === 'queued' || document.status === 'running') {
      const startedAt = statusStartedAt(document, 'uploaded' in object ? object.uploaded : undefined)
      if (startedAt !== null && this.now() - startedAt > studioTranscodeStallMs) return this.summary(await this.setState(row, 'failed', statusEtag, `Studio transcode stalled: still ${document.status} with no terminal status after ${studioTranscodeStallMs / 3600000} hours`))
      return this.summary(await this.setState(row, 'awaiting-transcode', statusEtag, null))
    }
    if (document.status === 'failed') return this.summary(await this.setState(row, 'failed', statusEtag, (document.error ?? 'Studio transcode failed').slice(0, 2000)))
    return this.attach(row, document.review!, statusEtag)
  }

  private async attach(row: StudioAdoption, deliverable: ReviewDeliverable, statusEtag: string) {
    const head = await this.content.head(deliverable.key)
    if (!head || normalizeEtag(head.etag) !== normalizeEtag(deliverable.etag) || head.size !== deliverable.bytes || head.httpMetadata?.contentType !== deliverable.contentType) throw new ReviewError(409, 'Studio deliverable changed')
    const assets = await this.register(row, deliverable)
    // The expectation is read now, at attach time, so a later Studio take or staff
    // cut never dead-ends this adoption: the newest attached cut becomes current.
    const expected = (await this.store.one<{ current_revision: string | null }>('SELECT current_revision FROM video_review_state WHERE video_id=?', row.video_id))?.current_revision ?? null
    await this.batch([statement("UPDATE review_studio_adoptions SET expected_current_revision=?,status_etag=?,updated_at=? WHERE id=? AND state<>'attached'", expected, statusEtag, this.now(), row.id)])
    let revisionId: string
    try {
      const result = await this.review.execute(this.actor, { action: 'create-revision', videoId: row.video_id, commandId: row.revision_command, mediaId: assets.source, deliverableMediaId: assets.deliverable, durationMs: deliverable.durationMs, metadata: JSON.parse(row.metadata) }, { currentRevisionId: expected }) as { revisionId: string }
      revisionId = result.revisionId
    } catch (error) {
      if (!(error instanceof ReviewError) || error.status !== 409) throw error
      // A rejected execute never journals, so the command id is safe to reuse. A
      // journal row means a concurrent adopt of this same row won.
      const journal = await this.store.one<{ result: string }>('SELECT result FROM review_commands WHERE id=?', row.revision_command)
      if (!journal) return this.summary(await this.setState(row, 'awaiting-transcode', statusEtag, `${error.message}; retrying`.slice(0, 2000)))
      revisionId = (JSON.parse(journal.result) as { revisionId: string }).revisionId
    }
    await this.batch([statement("UPDATE review_studio_adoptions SET state='attached',revision_id=?,error=NULL,updated_at=? WHERE id=? AND state<>'attached'", revisionId, this.now(), row.id)])
    return this.summary(await this.reload(row))
  }

  private async register(row: StudioAdoption, deliverable: ReviewDeliverable) {
    const load = async () => Object.fromEntries((await this.store.all<{ kind: string; media_id: number }>('SELECT kind,media_id FROM review_studio_assets WHERE adoption_id=?', row.id)).map(asset => [asset.kind, asset.media_id])) as { source?: number; deliverable?: number }
    let assets = await load()
    if (assets.source === undefined || assets.deliverable === undefined) {
      const token = crypto.randomUUID()
      const objects = [
        { kind: 'source', key: row.source_key, etag: normalizeEtag(row.source_etag), checksum: studioSourceChecksum(row.source_etag), bytes: row.source_bytes, contentType: sourceTypes[row.source_format], duration: null },
        { kind: 'deliverable', key: deliverable.key, etag: normalizeEtag(deliverable.etag), checksum: deliverable.sha256, bytes: deliverable.bytes, contentType: deliverable.contentType, duration: deliverable.durationMs },
      ]
      try {
        await this.batch([
          statement("INSERT INTO review_command_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM review_studio_adoptions WHERE id=? AND state IN ('awaiting-transcode','failed')) THEN 1 ELSE 0 END", token, row.id),
          ...objects.flatMap(object => [
            statement('INSERT INTO media(filename,mime_type,filesize) VALUES(?,?,?)', object.key, object.contentType, object.bytes),
            statement('INSERT INTO review_studio_assets(media_id,adoption_id,video_id,kind,bucket,object_key,object_etag,checksum,bytes,content_type,duration_ms) SELECT id,?,?,?,?,?,?,?,?,?,? FROM media WHERE filename=?', row.id, row.video_id, object.kind, row.source_bucket, object.key, object.etag, object.checksum, object.bytes, object.contentType, object.duration, object.key),
          ]),
          statement('DELETE FROM review_command_guards WHERE id=?', token),
        ])
      } catch (error) {
        // A replayed or concurrent registration already committed the same rows.
        if (!/UNIQUE constraint failed|CHECK constraint failed/.test(String(error))) throw error
      }
      assets = await load()
      if (assets.source === undefined || assets.deliverable === undefined) throw new ReviewError(409, 'Studio adoption changed; retry')
    }
    return assets as { source: number; deliverable: number }
  }

  listPending(limit = 50) { return listPendingStudioAdoptions(this.store, limit) }
}

// Staff view: adoptions that are stuck, failed or attached without a publication yet.
export function listPendingStudioAdoptions(store: ReviewStore, limit = 50) {
  return store.all<{ adoptionId: string; videoId: number; legacyVideoId: string; studioSessionId: string; recordingId: string; state: string; revisionId: string | null; error: string | null; createdAt: number; updatedAt: number }>(
    `SELECT a.id AS adoptionId,a.video_id AS videoId,a.legacy_video_id AS legacyVideoId,a.studio_session_id AS studioSessionId,a.recording_id AS recordingId,a.state,a.revision_id AS revisionId,a.error,a.created_at AS createdAt,a.updated_at AS updatedAt
     FROM review_studio_adoptions a
     WHERE a.state<>'attached' OR NOT EXISTS(SELECT 1 FROM review_publication_events p WHERE p.revision_id=a.revision_id)
     ORDER BY a.updated_at,a.id LIMIT ?`, Math.max(1, Math.min(limit, 200)))
}
