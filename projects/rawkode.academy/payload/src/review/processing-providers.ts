import { z } from 'zod'
import { ReviewError } from './contracts'
import { storedObject, whisperModel, type ProbeResult } from './intake-contracts'
import { hex, verifyStored } from './intake-storage'
import { audioPolicy, type ProcessingJob } from './processing-jobs'

const audioChunk = storedObject.extend({
  bytes: z.number().int().positive().max(audioPolicy.maximumChunkBytes),
  index: z.number().int().nonnegative(), startMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().max(audioPolicy.maximumChunkDurationMs),
  contentType: z.literal('audio/wav'), codec: z.literal('pcm_s16le'), sampleRate: z.literal(16000), channels: z.literal(1),
}).strict()
export const audioManifest = z.object({ jobId: z.string().uuid(), recipe: z.string(), source: storedObject,
  durationMs: z.number().int().positive().max(7200000), noAudio: z.boolean(), chunks: z.array(audioChunk).max(audioPolicy.maximumChunks),
}).strict()
export type AudioManifest = z.infer<typeof audioManifest>
export type AudioChunk = z.infer<typeof audioChunk>
export function validateAudio(job: ProcessingJob, value: unknown): AudioManifest {
  const parsed = audioManifest.safeParse(value)
  if (!parsed.success) throw new ReviewError(409, 'Invalid extracted audio manifest')
  const audio = parsed.data
  if (audio.jobId !== job.jobId || audio.recipe !== job.recipe || JSON.stringify(audio.source) !== JSON.stringify(job.source)) throw new ReviewError(409, 'Audio belongs to another source or recipe')
  let end = 0
  for (const [index, chunk] of audio.chunks.entries()) {
    if (chunk.index !== index || chunk.key !== `review-intake/${job.jobId}/audio/${index}.wav` || chunk.startMs !== end) throw new ReviewError(409, 'Audio chunk keys or coverage are invalid')
    end += chunk.durationMs
  }
  if (audio.noAudio ? audio.chunks.length !== 0 : !audio.chunks.length || end !== audio.durationMs) throw new ReviewError(409, 'Audio coverage is incomplete')
  return audio
}
export interface FFmpegBoundary {
  encode(job: ProcessingJob): Promise<unknown>
  extractAudio(job: ProcessingJob): Promise<unknown>
}
export async function boundedBytes(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) throw new ReviewError(502, 'Provider response has no body')
  const reader = body.getReader(), parts: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.length
    if (length > maximum) { await reader.cancel(); throw new ReviewError(502, 'Provider response exceeds its limit') }
    parts.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  return bytes
}
/** Machine-only client. The DO loads the trusted D1 job, owns R2 access, and
 * accepts artifacts only from its image-baked recipe. */
export class ContainerFFmpegClient implements FFmpegBoundary {
  constructor(readonly binding: Pick<Fetcher, 'fetch'> | DurableObjectNamespace) {}
  private async call(operation: 'encode' | 'audio', job: ProcessingJob) {
    const binding = 'getByName' in this.binding ? this.binding.getByName(`${job.jobId}:${operation}:${job.recipe}`) : this.binding
    const response = await binding.fetch(`https://review-ffmpeg.internal/jobs/${job.jobId}/${operation}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol: 1, job }),
    })
    if (!response.ok) { await response.body?.cancel(); throw new ReviewError(502, 'Container processing request failed') }
    try { return JSON.parse(new TextDecoder().decode(await boundedBytes(response.body, 262144))) }
    catch (error) { if (error instanceof ReviewError) throw error; throw new ReviewError(502, 'Container response is not JSON') }
  }
  encode(job: ProcessingJob) { return this.call('encode', job) }
  extractAudio(job: ProcessingJob) { return this.call('audio', job) }
}
export interface WhisperBinding { run(model: typeof whisperModel, input: { audio: string; task: 'transcribe'; vad_filter: boolean }): Promise<unknown> }
export class WorkersWhisper {
  constructor(readonly ai: WhisperBinding, readonly bucket: R2Bucket) {}
  async transcribe(chunk: AudioChunk) {
    await verifyStored(this.bucket, chunk, 'audio/wav')
    const object = await this.bucket.get(chunk.key, { onlyIf: { etagMatches: chunk.etag } })
    if (!object || !('body' in object)) throw new ReviewError(409, 'Audio changed before transcription')
    const bytes = await boundedBytes(object.body, Math.min(chunk.bytes, audioPolicy.maximumChunkBytes))
    if (bytes.length !== chunk.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== chunk.checksum) throw new ReviewError(409, 'Audio bytes do not match the pinned chunk')
    let binary = ''
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
    const result = await this.ai.run(whisperModel, { audio: btoa(binary), task: 'transcribe', vad_filter: true })
    const text = z.object({ text: z.string().max(10000) }).safeParse(result)
    if (!text.success) throw new ReviewError(502, 'Whisper returned invalid or excessive transcript text')
    return text.data.text
  }
}
export function joinTranscript(job: ProcessingJob, parts: string[]): NonNullable<ProbeResult['transcription']> {
  const transcript = parts.join('\n')
  if (transcript.length > job.audioPolicy.maximumTranscriptCharacters) throw new ReviewError(409, 'Transcript exceeds editorial limits')
  return { model: job.audioPolicy.model, sourceChecksum: job.source.checksum, transcript }
}
