import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export const maximumBytes = 64 * 1024 * 1024
export const maximumDurationMs = 7200000
const sha = /^[a-f0-9]{64}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export class Rejection extends Error { constructor(message, status = 422) { super(message); this.status = status } }
const fail = message => { throw new Rejection(message) }
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max
const keys = (o, expected) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join(',') === expected.split(',').sort().join(',')
export function validateJob(raw, recipe) {
  if (typeof raw !== 'string' || raw.length > 8192 || !sha.test(recipe)) fail('Invalid job header')
  let j
  try { j = JSON.parse(raw) } catch { fail('Invalid job JSON') }
  if (!keys(j, 'jobId,videoId,recipe,source,contentType,outputKey,maximumBytes,maximumDurationMs,audioPolicy,startedAt,deadline,expectedCurrentRevisionId') || !uuid.test(j.jobId) || !integer(j.videoId, 1, Number.MAX_SAFE_INTEGER) || j.recipe !== recipe) fail('Invalid job identity')
  if (!keys(j.source, 'key,etag,checksum,bytes') || j.source.key !== `review-intake/${j.jobId}/source` || typeof j.source.etag !== 'string' || !j.source.etag.length || j.source.etag.length > 200 || !sha.test(j.source.checksum) || !integer(j.source.bytes, 1, maximumBytes)) fail('Invalid source identity')
  if (j.outputKey !== `review-intake/${j.jobId}/deliverable.mp4` || !['video/mp4', 'video/quicktime', 'video/webm'].includes(j.contentType) || j.maximumBytes !== maximumBytes || j.maximumDurationMs !== maximumDurationMs) fail('Invalid media policy')
  const a = j.audioPolicy
  if (!keys(a, 'model,maximumChunks,maximumChunkBytes,maximumChunkDurationMs,maximumTranscriptCharacters') || a.model !== '@cf/openai/whisper-large-v3-turbo' || a.maximumChunks !== 120 || a.maximumChunkBytes !== 2097152 || a.maximumChunkDurationMs !== 60000 || a.maximumTranscriptCharacters !== 100000) fail('Invalid audio policy')
  if (!integer(j.startedAt, 0, Number.MAX_SAFE_INTEGER) || !integer(j.deadline, j.startedAt + 1, j.startedAt + 86400) || !(j.expectedCurrentRevisionId === null || uuid.test(j.expectedCurrentRevisionId))) fail('Invalid job lifetime')
  return j
}
export async function fileDigest(path) {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const part of createReadStream(path)) { hash.update(part); bytes += part.length }
  return { bytes, checksum: hash.digest('hex') }
}
