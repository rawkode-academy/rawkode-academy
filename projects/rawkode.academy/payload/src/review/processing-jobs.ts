import { z } from 'zod'
import { ReviewError } from './contracts'
import { maximumIntakeBytes, probeResult, storedObject, sourceTypes, type ProbeResult, whisperModel } from './intake-contracts'
import { verifyStored } from './intake-storage'
import { ReviewStore, type Statement } from './store'

export const audioPolicy = { model: whisperModel, maximumChunks: 120, maximumChunkBytes: 2097152, maximumChunkDurationMs: 60000, maximumTranscriptCharacters: 100000 } as const
export const jobManifest = z.object({
  jobId: z.string().uuid(), videoId: z.number().int().positive(), recipe: z.string().regex(/^[a-f0-9]{64}$/),
  source: storedObject, contentType: z.enum(sourceTypes), outputKey: z.string(),
  maximumBytes: z.literal(maximumIntakeBytes), maximumDurationMs: z.literal(7200000),
  audioPolicy: z.object({ model: z.literal(whisperModel), maximumChunks: z.literal(120), maximumChunkBytes: z.literal(2097152), maximumChunkDurationMs: z.literal(60000), maximumTranscriptCharacters: z.literal(100000) }).strict(),
  startedAt: z.number().int(), deadline: z.number().int(), expectedCurrentRevisionId: z.string().uuid().nullable(),
}).strict()
export type ProcessingJob = z.infer<typeof jobManifest>
export type UploadSession = { id: string; video_id: number; owner_id: number; state: string; object_key: string; output_key: string; source_etag: string | null; expected_bytes: number; expected_checksum: string; claimed_type: string; expires_at: number }
type JobRow = { manifest: string; result: string | null; completed_at: number | null }
const statement = (sql: string, ...values: Statement['values']): Statement => ({ sql, values })
export async function validateEvidence(bucket: R2Bucket, job: ProcessingJob, value: unknown): Promise<ProbeResult> {
  const parsed = probeResult.safeParse(value)
  if (!parsed.success) throw new ReviewError(409, 'Provider returned invalid media evidence')
  const e = parsed.data, s = job.source
  if (e.jobId !== job.jobId || e.recipe !== job.recipe || e.source.key !== s.key || e.source.etag !== s.etag || e.source.checksum !== s.checksum || e.source.bytes !== s.bytes || e.source.contentType !== job.contentType || e.deliverable.key !== job.outputKey || e.deliverable.durationMs > job.maximumDurationMs || e.deliverable.bytes > job.maximumBytes || (e.transcription && e.transcription.sourceChecksum !== s.checksum)) throw new ReviewError(409, 'Provider evidence does not match the durable job')
  await verifyStored(bucket, s, 'application/octet-stream')
  await verifyStored(bucket, e.deliverable, 'video/mp4')
  return e
}
export class ProcessingJobs {
  constructor(readonly store: ReviewStore, readonly bucket: R2Bucket, readonly now = () => Math.floor(Date.now() / 1000)) {}
  row(id: string) { return this.store.one<JobRow>('SELECT manifest,result,completed_at FROM review_processing_jobs WHERE session_id=?', id) }
  async load(id: string) {
    const [row, session] = await Promise.all([this.row(id), this.store.one<UploadSession>('SELECT * FROM review_upload_sessions WHERE id=?', id)])
    if (!row || !session || !['processing', 'ready'].includes(session.state)) throw new ReviewError(409, 'Processing job is unavailable or cancelled')
    const job = jobManifest.parse(JSON.parse(row.manifest))
    if (job.jobId !== id || job.videoId !== session.video_id || job.source.key !== session.object_key || job.source.etag !== session.source_etag || job.source.checksum !== session.expected_checksum || job.source.bytes !== session.expected_bytes || job.outputKey !== session.output_key || job.contentType !== session.claimed_type) throw new ReviewError(409, 'Processing source identity changed')
    // Completed evidence is retained beyond the execution deadline for later
    // staff polling. A retry never extends an unfinished job's deadline.
    if (!row.result && job.deadline <= this.now()) throw new ReviewError(410, 'Processing deadline expired; create a new intake')
    return { job, result: row.result ? probeResult.parse(JSON.parse(row.result)) : null }
  }
  private async batch(statements: Statement[]) { await this.store.db.batch(statements.map(s => this.store.db.prepare(s.sql).bind(...s.values))) }
  async start(session: UploadSession, recipe: string): Promise<ProcessingJob> {
    const existing = await this.row(session.id)
    if (existing) {
      const saved = await this.load(session.id)
      if (saved.job.recipe !== recipe) throw new ReviewError(409, 'Processing recipe changed; keep the original provider or start a new intake')
      return saved.job
    }
    if (session.state !== 'uploaded' || session.expires_at <= this.now() || !session.source_etag) throw new ReviewError(410, 'Upload admission expired or source is incomplete')
    const state = await this.store.one<{ current_revision: string | null }>('SELECT current_revision FROM video_review_state WHERE video_id=?', session.video_id)
    const job = jobManifest.parse({ jobId: session.id, videoId: session.video_id, recipe, source: { key: session.object_key, etag: session.source_etag, checksum: session.expected_checksum, bytes: session.expected_bytes }, contentType: session.claimed_type, outputKey: session.output_key, maximumBytes: maximumIntakeBytes, maximumDurationMs: 7200000, audioPolicy, startedAt: this.now(), deadline: this.now() + 86400, expectedCurrentRevisionId: state?.current_revision ?? null })
    const token = crypto.randomUUID()
    try {
      await this.batch([
        statement("INSERT INTO review_command_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM review_upload_sessions WHERE id=? AND state='uploaded' AND expires_at>? AND source_etag=?) AND (SELECT current_revision FROM video_review_state WHERE video_id=?) IS ? THEN 1 ELSE 0 END", token, session.id, this.now(), session.source_etag, session.video_id, job.expectedCurrentRevisionId),
        statement('INSERT INTO review_processing_jobs(session_id,manifest) VALUES(?,?)', session.id, JSON.stringify(job)),
        statement("UPDATE review_upload_sessions SET state='processing' WHERE id=?", session.id),
        statement('DELETE FROM review_command_guards WHERE id=?', token),
      ])
    } catch (error) {
      if (await this.row(session.id)) return this.start(session, recipe)
      if (/CHECK constraint failed|UNIQUE constraint failed/.test(String(error))) throw new ReviewError(409, 'Review changed before dispatch; retry')
      throw error
    }
    return job
  }
  async complete(job: ProcessingJob, value: unknown) {
    const loaded = await this.load(job.jobId)
    if (JSON.stringify(job) !== JSON.stringify(loaded.job)) throw new ReviewError(409, 'Processing manifest changed')
    const evidence = await validateEvidence(this.bucket, job, value), result = JSON.stringify(evidence)
    if (loaded.result) {
      if (JSON.stringify(loaded.result) !== result) throw new ReviewError(409, 'Completed evidence conflicts with this result')
      return evidence
    }
    const token = crypto.randomUUID()
    try {
      await this.batch([
        statement("INSERT INTO review_command_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM review_upload_sessions WHERE id=? AND state='processing') AND ?>? THEN 1 ELSE 0 END", token, job.jobId, job.deadline, this.now()),
        statement('UPDATE review_processing_jobs SET result=?,completed_at=? WHERE session_id=?', result, this.now(), job.jobId),
        statement('DELETE FROM review_command_guards WHERE id=?', token),
      ])
    } catch (error) {
      const saved = await this.load(job.jobId)
      if (saved.result && JSON.stringify(saved.result) === result) return evidence
      if (/CHECK constraint|immutable/.test(String(error))) throw new ReviewError(409, 'Processing completion was fenced or conflicts')
      throw error
    }
    return evidence
  }
}
