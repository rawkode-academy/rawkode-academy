import { ReviewError } from './contracts'

export const maximumReviewMediaBytes = 32 * 1024 * 1024
// Checked-in synthetic.mp4: ffprobe confirms H.264/AAC, 1 second; full ffmpeg
// decode verified. This is an explicit local fixture gate, not a general probe.
export const fixtureChecksum = '13498583cd70db12cf2381b58e2de1d49680018e15dcdde12dfe314c8a5e512a'
export function verifiedDeliverable(checksum: string, local: boolean, fixtureEnabled: boolean) {
  if (!local || !fixtureEnabled || checksum !== fixtureChecksum) throw new ReviewError(503, 'A trusted media probe is required. Only the explicitly enabled local synthetic fixture is supported.')
  return { checksum, durationMs: 1000, contentType: 'video/mp4' }
}
export async function digestBytes(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function boundedObject(bucket: R2Bucket, key: string) {
  const head = await bucket.head(key)
  if (!head || head.size < 1 || head.size > maximumReviewMediaBytes) throw new ReviewError(400, 'Review media must be present and at most 32 MiB')
  const object = await bucket.get(key, { onlyIf: { etagMatches: head.etag } })
  if (!object || !('body' in object)) throw new ReviewError(409, 'Media changed during verification')
  const bytes = await object.arrayBuffer()
  return { bytes, checksum: await digestBytes(bytes), etag: head.etag }
}
export async function stageReleaseObject(bucket: R2Bucket, key: string, bytes: ArrayBuffer, checksum: string, contentType: string) {
  if (await digestBytes(bytes) !== checksum) throw new ReviewError(409, 'Release checksum mismatch')
  // A failed D1 command may leave this private object behind. Retrying the same
  // command reuses identical bytes; no public route can serve it before commit.
  const object = await bucket.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType } })
  if (!object) {
    const existing = await boundedObject(bucket, key)
    if (existing.checksum !== checksum) throw new ReviewError(409, 'Immutable release key already contains different bytes')
    return { key, etag: existing.etag, checksum, bytes: bytes.byteLength, contentType }
  }
  return { key, etag: object.etag, checksum, bytes: bytes.byteLength, contentType }
}
