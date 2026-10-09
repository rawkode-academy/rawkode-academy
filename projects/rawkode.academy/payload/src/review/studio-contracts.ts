import { z } from 'zod'
import { ReviewError, metadataSchema, type ReviewMetadata } from './contracts'

// Studio -> Payload review handoff. Studio signs every call with src/machine-auth.ts.
export const STUDIO_HANDOFF_PATH = '/api/studio-handoff/adoptions'
export const maximumStudioSourceBytes = 50 * 1024 * 1024 * 1024
const segment = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
const relativeKey = z.string().max(512).regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,127})*$/)
export const studioSourceFormats = ['webm', 'mkv', 'mp4'] as const
export const adoptCommand = z.object({
  idempotencyKey: z.string().regex(/^studio:[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,128}:[A-Za-z0-9-]{1,200}$/),
  legacyVideoId: relativeKey,
  studioSessionId: segment,
  recordingId: segment,
  source: z.object({
    bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    key: relativeKey,
    etag: z.string().regex(/^[A-Za-z0-9-]{1,200}$/),
    bytes: z.number().int().min(1).max(maximumStudioSourceBytes),
    format: z.enum(studioSourceFormats),
  }).strict(),
  reviewPrefix: z.string().max(512),
  requestedBy: z.object({
    githubHandle: z.string().max(100).optional(),
    issuer: z.string().url().max(200).optional(),
    subject: z.string().max(200).optional(),
  }).strict().optional(),
  title: z.string().max(300).optional(),
}).strict()
export type AdoptCommand = z.infer<typeof adoptCommand>
export const statusQuery = z.union([
  z.object({ adoptionId: z.string().uuid() }).strict(),
  z.object({ idempotencyKey: adoptCommand.shape.idempotencyKey }).strict(),
])

export function normalizeEtag(value: string) {
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '')
}
export function studioRecordingPrefix(command: Pick<AdoptCommand, 'studioSessionId' | 'recordingId'>) {
  return `studio/recordings/${command.studioSessionId}/${command.recordingId}/`
}
export function studioIdempotencyKey(studioSessionId: string, recordingId: string, etag: string) {
  return `studio:${studioSessionId}:${recordingId}:${normalizeEtag(etag)}`
}
export function assertStudioPaths(command: AdoptCommand, bucketName: string) {
  const prefix = studioRecordingPrefix(command)
  if (command.source.key !== `${prefix}source.${command.source.format}`) throw new ReviewError(400, 'Studio source key does not match the recording')
  if (command.reviewPrefix !== `${prefix}review/`) throw new ReviewError(400, 'Studio review prefix does not match the recording')
  if (command.source.bucket !== bucketName) throw new ReviewError(400, 'Studio source bucket is not the content bucket')
  if (command.idempotencyKey !== studioIdempotencyKey(command.studioSessionId, command.recordingId, command.source.etag)) throw new ReviewError(400, 'Idempotency key does not match the recording source')
}

// Passthrough: ingest adds queuedAt/failedAt/videoId/sourceKey and the transcoder
// adds startedAt/completedAt; neither is a contract field here.
export const reviewDeliverable = z.object({
  key: z.string().max(512),
  etag: z.string().min(1).max(200),
  bytes: z.number().int().min(1).max(5 * 1024 * 1024 * 1024),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  durationMs: z.number().int().min(1).max(86400000),
  contentType: z.literal('video/mp4'),
}).strict()
export const transcodeStatusDocument = z.object({
  status: z.enum(['queued', 'running', 'complete', 'failed']),
  outputPrefix: z.string(),
  sourceEtag: z.string().optional(),
  outputMode: z.string().optional(),
  review: reviewDeliverable.optional(),
  error: z.string().optional(),
}).passthrough()
export type TranscodeStatusDocument = z.infer<typeof transcodeStatusDocument>
export type ReviewDeliverable = z.infer<typeof reviewDeliverable>
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Parses a transcode-status.json body for one adoption. Anything that does not
// belong to this exact source and private prefix is a contract failure, never progress.
export function parseTranscodeStatus(value: unknown, adoption: { review_prefix: string; source_etag: string }) {
  const parsed = transcodeStatusDocument.safeParse(value)
  if (!parsed.success) throw new ReviewError(409, 'Studio transcode status is malformed')
  const document = parsed.data
  if (document.outputPrefix !== adoption.review_prefix) throw new ReviewError(409, 'Studio transcode status belongs to another prefix')
  if (document.sourceEtag !== undefined && normalizeEtag(document.sourceEtag) !== normalizeEtag(adoption.source_etag)) throw new ReviewError(409, 'Studio transcode status belongs to another source')
  if (document.status === 'complete') {
    if (!document.review) throw new ReviewError(409, 'Studio transcode completed without a review deliverable')
    if (!new RegExp(`^${escapeRegExp(adoption.review_prefix)}[A-Za-z0-9._-]{1,128}/review\\.mp4$`).test(document.review.key)) throw new ReviewError(409, 'Studio review deliverable is outside the private prefix')
  }
  return document
}

type VideoText = { title?: unknown; description?: unknown }
const textOf = (value: unknown) => typeof value === 'string' ? value.trim() : ''
// Frozen into the adoption row so every retry hashes and validates identically.
export function clampMetadata(video: VideoText, command: Pick<AdoptCommand, 'title'>, recordingId: string): ReviewMetadata {
  const title = (textOf(video.title) || textOf(command.title) || `Studio recording ${recordingId}`).slice(0, 300).trim() || `Studio recording ${recordingId}`.slice(0, 300)
  const description = (textOf(video.description) || `Recorded in Rawkode Studio (${recordingId})`).slice(0, 8000).trim() || 'Recorded in Rawkode Studio'
  return metadataSchema.parse({ title, description, transcript: '', chapters: [] })
}

// Byte-identical JSON in tasks/transcoding-job/utilities/status_test.ts and the
// ingest contract tests: the transcoder's review-proxy completion document.
export const STUDIO_REVIEW_STATUS_FIXTURE = `{
  "status": "complete",
  "videoId": "video-1",
  "studioSessionId": "session-1",
  "recordingId": "recording-1",
  "sourceBucket": "rawkode-academy-content",
  "sourceKey": "studio/recordings/session-1/recording-1/source.webm",
  "sourceEtag": "source-etag-1",
  "sourceFormat": "webm",
  "outputPrefix": "studio/recordings/session-1/recording-1/review/",
  "completedAt": "2026-10-09T12:00:00.000Z",
  "outputMode": "review-proxy",
  "review": {
    "key": "studio/recordings/session-1/recording-1/review/transcoding-job-x7k2p-a0/review.mp4",
    "etag": "review-etag-1",
    "bytes": 1048576,
    "sha256": "4f8b42c22dd3729b519ba6f68d2da7cc5b2d606d05daed5ad5128cc03e6c6358",
    "durationMs": 61000,
    "contentType": "video/mp4"
  }
}`

// Public VOD lives on the content CDN under the legacy pipeline's videos/{id}/ prefix.
export const STUDIO_PUBLIC_CONTENT_ORIGIN = 'https://content.rawkode.academy'
export function studioPublicStreamUrl(legacyVideoId: string) {
  return `${STUDIO_PUBLIC_CONTENT_ORIGIN}/videos/${legacyVideoId}/stream.m3u8`
}
