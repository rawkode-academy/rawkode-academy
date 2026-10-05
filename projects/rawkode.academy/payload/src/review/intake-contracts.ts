import { z } from 'zod'
import { metadataSchema } from './contracts'

export const maximumIntakeBytes = 64 * 1024 * 1024
export const sourceTypes = ['video/mp4', 'video/quicktime', 'video/webm'] as const
const sha = z.string().regex(/^[a-f0-9]{64}$/)
const bytes = z.number().int().positive().max(maximumIntakeBytes)
export const intakeCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin'), commandId: z.string().uuid(), videoId: z.number().int().positive(), bytes, checksum: sha, contentType: z.enum(sourceTypes), metadata: metadataSchema }).strict(),
  z.object({ action: z.enum(['process', 'cancel']), sessionId: z.string().uuid() }).strict(),
])
export const storedObject = z.object({ key: z.string().min(1).max(300), etag: z.string().min(1).max(200), checksum: sha, bytes }).strict()
export type StoredObject = z.infer<typeof storedObject>
export const probeResult = z.object({
  jobId: z.string().uuid(), recipe: sha,
  source: storedObject.extend({ contentType: z.enum(sourceTypes) }).strict(),
  deliverable: storedObject.extend({
    contentType: z.literal('video/mp4'), durationMs: z.number().int().positive().max(86400000),
    videoCodec: z.literal('h264'), audioCodec: z.enum(['aac', 'none']),
    width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192),
    fastStart: z.literal(true), fullDecode: z.literal(true),
  }).strict(),
}).strict()
export type ProbeResult = z.infer<typeof probeResult>

/** Server-installed adapter only, never a browser result/callback. The Container
 * must dispatch/poll a durable Workflow/Container job keyed by jobId and recipe;
 * an HTTP request must never own the lifetime of an encoding job. Return the
 * processing marker promptly until that durable job has finished. The job must
 * stream R2 input pinned to ETag, probe and fully decode it, encode H.264/AAC
 * fast-start MP4, then stream output with native SHA-256 validation and an
 * if-none-match write. Same job/recipe retries must return identical artifacts.
 * No shell strings, customer URLs, keys or executable arguments enter this API.
 */
export interface ContainerMediaAdapter {
  readonly recipe: string // Immutable image/encoding recipe SHA-256.
  process(input: { jobId: string; source: StoredObject; outputKey: string; maximumBytes: number; maximumDurationMs: number }): Promise<ProbeResult | { state: 'processing' }>
}
/** Separate future Workers AI boundary. The provider owns bounded audio chunks,
 * verified audio extraction, model/version and timeout/retry policy. Generated
 * text is editorial input, never approval or proof of playable media.
 */
export interface WorkersAITranscriptionAdapter {
  transcribe(input: { jobId: string; audio: StoredObject; model: string }): Promise<{ transcript: string; model: string; sourceChecksum: string }>
}
// There is no configured Container/FFmpeg or Workers AI provider in this repo.
// Installing an implementation requires an explicit runtime binding, not an env
// flag that makes a caller-supplied attestation trusted.
export function configuredMediaAdapter(): ContainerMediaAdapter | undefined { return undefined }
