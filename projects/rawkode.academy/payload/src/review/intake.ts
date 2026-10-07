import { z } from 'zod'
import { ProcessingJobs } from './processing-jobs'
import { ReviewError, validateMetadata, type ReviewActor } from './contracts'
import { intakeCommand, maximumIntakeBytes, probeResult, type ContainerMediaAdapter, type ProbeResult } from './intake-contracts'
import { uploadSource, verifyStored, type LengthStream } from './intake-storage'
import { ReviewStore, type Statement } from './store'
import type { ReviewService } from './service'

type Session = { id: string; begin_command: string; begin_input: string; owner_id: number; video_id: number; object_key: string; output_key: string; expected_bytes: number; expected_checksum: string; claimed_type: string; metadata: string; revision_command: string; state: 'pending' | 'uploaded' | 'processing' | 'ready' | 'cancelled'; source_etag: string | null; attestation: string | null; expires_at: number }
const statement = (sql: string, ...values: Statement['values']): Statement => ({ sql, values })
export class ReviewIntake {
  constructor(readonly store: ReviewStore, readonly bucket: R2Bucket, readonly review: ReviewService, readonly adapter?: ContainerMediaAdapter, readonly lengthStream?: LengthStream, readonly now = () => Math.floor(Date.now() / 1000)) {}
  private get jobs() { return new ProcessingJobs(this.store, this.bucket, this.now) }
  private staff(actor: ReviewActor) { if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required') }
  private async session(actor: ReviewActor, id: string) {
    this.staff(actor)
    if (!z.string().uuid().safeParse(id).success) throw new ReviewError(400, 'Invalid upload session')
    const row = await this.store.one<Session>('SELECT * FROM review_upload_sessions WHERE id=? AND owner_id=?', id, actor.id)
    if (!row) throw new ReviewError(404, 'Upload session not found')
    await this.review.dependencies.video(row.video_id, actor)
    return row
  }
  private active(row: Session) {
    if (row.state === 'cancelled') throw new ReviewError(409, 'Upload session was cancelled')
    if (row.expires_at <= this.now()) throw new ReviewError(410, 'Upload session expired')
  }
  private async batch(statements: Statement[]) { await this.store.db.batch(statements.map(s => this.store.db.prepare(s.sql).bind(...s.values))) }
  private async change(row: Session, states: Session['state'][], statements: Statement[], expiry: 'upload' | 'completed' | 'ignore' = 'upload') {
    const token = crypto.randomUUID()
    const permitted = expiry === 'upload' ? `expires_at>${this.now()}` : expiry === 'completed' ? 'EXISTS(SELECT 1 FROM review_processing_jobs j WHERE j.session_id=review_upload_sessions.id AND j.result IS NOT NULL)' : '1=1'
    try {
      await this.batch([
        statement(`INSERT INTO review_command_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM review_upload_sessions WHERE id=? AND owner_id=? AND state IN (${states.map(() => '?').join(',')}) AND ${permitted}) THEN 1 ELSE 0 END`, token, row.id, row.owner_id, ...states),
        ...statements, statement('DELETE FROM review_command_guards WHERE id=?', token),
      ])
    } catch (error) {
      if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error))) throw new ReviewError(409, 'Upload changed; refresh and retry')
      throw error
    }
  }
  private summary(row: Session) { return { sessionId: row.id, videoId: row.video_id, state: row.state, expiresAt: row.expires_at, maximumBytes: maximumIntakeBytes, processingAvailable: Boolean(this.adapter), uploadUrl: `/api/review/uploads?sessionId=${row.id}` } }
  async read(actor: ReviewActor, id: string) { return this.summary(await this.session(actor, id)) }
  async execute(actor: ReviewActor, value: unknown) {
    this.staff(actor)
    const parsed = intakeCommand.safeParse(value)
    if (!parsed.success) throw new ReviewError(400, 'Invalid intake command')
    const input = parsed.data
    if (input.action === 'begin') {
      await this.review.dependencies.video(input.videoId, actor)
      await this.review.validateThumbnail(input.videoId, input.metadata.thumbnailId)
      const prior = () => this.store.one<Session>('SELECT * FROM review_upload_sessions WHERE begin_command=?', input.commandId)
      const replay = (row: Session) => {
        if (row.owner_id !== actor.id || row.begin_input !== JSON.stringify(input)) throw new ReviewError(409, 'Command ID was used for another intake')
        return this.summary(row)
      }
      const saved = await prior()
      if (saved) return replay(saved)
      const id = crypto.randomUUID(), at = this.now()
      try {
        await this.batch([statement('INSERT INTO review_upload_sessions(id,begin_command,begin_input,owner_id,video_id,object_key,output_key,expected_bytes,expected_checksum,claimed_type,metadata,revision_command,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', id, input.commandId, JSON.stringify(input), actor.id, input.videoId, `review-intake/${id}/source`, `review-intake/${id}/deliverable.mp4`, input.bytes, input.checksum, input.contentType, JSON.stringify(input.metadata), crypto.randomUUID(), 'pending', at, at + 3600)])
      } catch (error) {
        const winner = await prior()
        if (winner) return replay(winner)
        throw error
      }
      return this.read(actor, id)
    }
    const row = await this.session(actor, input.sessionId)
    if (input.action === 'process') return this.process(actor, row)
    if (row.state === 'cancelled') return this.summary(row)
    await this.change(row, ['pending', 'uploaded', 'processing'], [statement("UPDATE review_upload_sessions SET state='cancelled' WHERE id=?", row.id)], 'ignore')
    return this.read(actor, row.id)
  }
  async upload(actor: ReviewActor, id: string, request: Request) {
    const row = await this.session(actor, id)
    this.active(row)
    if (!['pending', 'uploaded'].includes(row.state)) throw new ReviewError(409, 'Session is not accepting uploads')
    if (request.headers.get('content-type') !== row.claimed_type) throw new ReviewError(415, 'Content type must match the upload session')
    const contentLength = request.headers.get('content-length') ?? request.headers.get('x-upload-length')
    if (contentLength !== String(row.expected_bytes)) throw new ReviewError(400, 'Content length must match the upload session')
    if (!request.body) throw new ReviewError(400, 'Upload body is required')
    const stored = await uploadSource(this.bucket, row.object_key, request.body, row.expected_bytes, row.expected_checksum, this.lengthStream)
    if (row.source_etag && row.source_etag !== stored.etag) throw new ReviewError(409, 'Source object changed')
    await this.change(row, ['pending', 'uploaded'], [statement("UPDATE review_upload_sessions SET state='uploaded',source_etag=? WHERE id=?", stored.etag, row.id)])
    return this.read(actor, id)
  }
  private async attach(actor: ReviewActor, row: Session) {
    const assets = await this.store.all<{ kind: string; media_id: number }>('SELECT kind,media_id FROM review_intake_assets WHERE session_id=?', row.id)
    const savedJob = await this.jobs.row(row.id)
    const expectation = savedJob ? (await this.jobs.load(row.id)).job.expectedCurrentRevisionId : null
    const metadata = JSON.parse(row.metadata)
    const transcription = row.attestation ? probeResult.parse(JSON.parse(row.attestation)).transcription : undefined
    if (!metadata.transcript && transcription) metadata.transcript = transcription.transcript
    const result = await this.review.execute(actor, { action: 'create-revision', videoId: row.video_id, commandId: row.revision_command, mediaId: assets.find(a => a.kind === 'source')?.media_id, deliverableMediaId: assets.find(a => a.kind === 'deliverable')?.media_id, metadata }, { currentRevisionId: expectation })
    return { ...this.summary(row), revision: result }
  }
  private async process(actor: ReviewActor, row: Session) {
    if (row.state === 'ready') return this.attach(actor, row)
    if (!['uploaded', 'processing'].includes(row.state) || !row.source_etag) throw new ReviewError(409, 'Complete the source upload first')
    if (!this.adapter) throw new ReviewError(503, 'Container media probe/encode provider is not configured')
    const job = await this.jobs.start(row, this.adapter.recipe)
    await verifyStored(this.bucket, job.source, 'application/octet-stream')
    const saved = await this.jobs.load(row.id)
    const result = saved.result ?? await this.adapter.process({ jobId: row.id, source: job.source, outputKey: job.outputKey, maximumBytes: job.maximumBytes, maximumDurationMs: job.maximumDurationMs })
    if (z.object({ state: z.literal('processing') }).strict().safeParse(result).success) return this.read(actor, row.id)
    const evidence = await this.jobs.complete(job, result)
    validateMetadata(JSON.parse(row.metadata), evidence.deliverable.durationMs)
    const attestation = JSON.stringify(evidence)
    try {
      await this.change(row, ['processing'], [...this.register(row, evidence), statement("UPDATE review_upload_sessions SET state='ready',attestation=? WHERE id=?", attestation, row.id)], 'completed')
    } catch (error) {
      const current = await this.session(actor, row.id)
      if (current.state !== 'ready' || current.attestation !== attestation) throw error
    }
    return this.attach(actor, await this.session(actor, row.id))
  }
  private register(row: Session, evidence: ProbeResult): Statement[] {
    return (['source', 'deliverable'] as const).flatMap(kind => {
      const object = evidence[kind], duration = kind === 'deliverable' ? evidence.deliverable.durationMs : null
      return [
        statement('INSERT INTO media(filename,mime_type,filesize) VALUES(?,?,?)', object.key, object.contentType, object.bytes),
        statement('INSERT INTO review_intake_assets(media_id,session_id,video_id,kind,object_key,object_etag,checksum,bytes,content_type,duration_ms) SELECT id,?,?,?,?,?,?,?,?,? FROM media WHERE filename=?', row.id, row.video_id, kind, object.key, object.etag, object.checksum, object.bytes, object.contentType, duration, object.key),
      ]
    })
  }
}
