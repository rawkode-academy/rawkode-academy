import { z } from 'zod'
import { isCuid2 } from '../cuid2'
import { ReviewError } from './contracts'
import { sourceTypes } from './intake-contracts'
import type { ProcessingJob } from './processing-jobs'

const artifact = z.object({ kind: z.enum(['deliverable', 'audio']), index: z.number().int().nonnegative(), bytes: z.number().int().positive().max(67108864), checksum: z.string().regex(/^[a-f0-9]{64}$/), startMs: z.number().int().nonnegative().optional(), durationMs: z.number().int().positive().max(60000).optional() }).strict()
const common = { protocol: z.literal(1), jobId: z.string().refine(isCuid2), recipe: z.string(), source: z.object({ contentType: z.enum(sourceTypes) }).strict(), durationMs: z.number().int().positive().max(7200000), artifacts: z.array(artifact).max(120) }
const reportSchema = z.discriminatedUnion('operation', [
  z.object({ ...common, operation: z.literal('encode'), videoCodec: z.literal('h264'), audioCodec: z.enum(['aac', 'none']), width: z.number().int().positive().max(1280), height: z.number().int().positive().max(720), fastStart: z.literal(true), fullDecode: z.literal(true) }).strict(),
  z.object({ ...common, operation: z.literal('audio'), noAudio: z.boolean() }).strict(),
])
export type ContainerReport = z.infer<typeof reportSchema>
export type Operation = ContainerReport['operation']
export function validateReport(value: unknown, job: ProcessingJob, operation: Operation) {
  const parsed = reportSchema.safeParse(value)
  if (!parsed.success) throw new ReviewError(502, 'Invalid Container artifact report')
  const report = parsed.data
  if (report.operation !== operation || report.jobId !== job.jobId || report.recipe !== job.recipe || report.source.contentType !== job.contentType || report.durationMs > job.maximumDurationMs) throw new ReviewError(409, 'Container report does not match the pinned job')
  if (report.operation === 'encode') {
    const [a] = report.artifacts
    if (report.artifacts.length !== 1 || a.kind !== 'deliverable' || a.index !== 0 || a.bytes > job.maximumBytes || a.startMs !== undefined || a.durationMs !== undefined) throw new ReviewError(502, 'Invalid deliverable artifact')
  } else {
    let end = 0
    for (const [index, a] of report.artifacts.entries()) {
      if (a.kind !== 'audio' || a.index !== index || a.bytes > job.audioPolicy.maximumChunkBytes || a.startMs !== end || !a.durationMs) throw new ReviewError(502, 'Invalid audio artifact coverage')
      end += a.durationMs
    }
    if (report.noAudio ? report.artifacts.length !== 0 : !report.artifacts.length || end !== report.durationMs) throw new ReviewError(502, 'Incomplete audio artifact coverage')
  }
  return report
}
/** A bounded framing reader. Cancelling one artifact drains just that artifact,
 * allowing immutable R2 objects from an interrupted attempt to be reused. */
export class ArtifactFrames {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>
  private pending: Uint8Array = new Uint8Array(0)
  constructor(body: ReadableStream<Uint8Array>) { this.reader = body.getReader() }
  private async take(maximum: number): Promise<Uint8Array> {
    if (!this.pending.length) {
      const next = await this.reader.read()
      if (next.done) throw new ReviewError(502, 'Truncated Container artifact stream')
      this.pending = next.value
      if (!this.pending.length) return this.take(maximum)
    }
    const part = this.pending.subarray(0, maximum)
    this.pending = this.pending.subarray(part.length)
    return part
  }
  private async bytes(length: number) {
    const bytes = new Uint8Array(length)
    for (let at = 0; at < length;) { const part = await this.take(length - at); bytes.set(part, at); at += part.length }
    return bytes
  }
  async report() {
    const prefix = await this.bytes(4), length = new DataView(prefix.buffer).getUint32(0)
    if (length < 2 || length > 65536) throw new ReviewError(502, 'Container manifest exceeds its limit')
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await this.bytes(length))) as unknown }
    catch (error) { if (error instanceof ReviewError) throw error; throw new ReviewError(502, 'Invalid Container manifest JSON') }
  }
  artifact(length: number) {
    let remaining = length
    return new ReadableStream<Uint8Array>({
      pull: async controller => {
        if (!remaining) { controller.close(); return }
        const part = await this.take(remaining); remaining -= part.length; controller.enqueue(part)
      },
      cancel: async () => { while (remaining) remaining -= (await this.take(remaining)).length },
    }, { highWaterMark: 0 })
  }
  async finish() {
    if (this.pending.length || !(await this.reader.read()).done) throw new ReviewError(502, 'Unexpected bytes after Container artifacts')
    this.reader.releaseLock()
  }
  async cancel() { try { await this.reader.cancel() } catch { /* Already released or disconnected. */ } }
}
