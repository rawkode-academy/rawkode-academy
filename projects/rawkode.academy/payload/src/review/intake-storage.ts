import { ReviewError } from './contracts'
import type { StoredObject } from './intake-contracts'
import { maximumIntakeBytes } from './intake-contracts'
import { ReviewStore } from './store'

export function hex(value: ArrayBuffer | undefined) {
  return value ? Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('') : ''
}
export async function verifyStored(bucket: R2Bucket, expected: StoredObject, contentType?: string) {
  const head = await bucket.head(expected.key)
  if (!head || head.etag !== expected.etag || head.size !== expected.bytes || hex(head.checksums.sha256) !== expected.checksum || (contentType && head.httpMetadata?.contentType !== contentType)) throw new ReviewError(409, 'Verified media object changed or lacks stored integrity evidence')
  return expected
}
export type LengthStream = (bytes: number) => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
export const fixedLengthStream: LengthStream = bytes => new FixedLengthStream(bytes)
export function uploadSource(bucket: R2Bucket, key: string, body: ReadableStream<Uint8Array>, bytes: number, checksum: string, lengthStream = fixedLengthStream) {
  return uploadImmutable(bucket, key, body, bytes, checksum, 'application/octet-stream', lengthStream)
}
export async function uploadImmutable(bucket: R2Bucket, key: string, body: ReadableStream<Uint8Array>, bytes: number, checksum: string, contentType: string, lengthStream = fixedLengthStream): Promise<StoredObject> {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > maximumIntakeBytes) throw new ReviewError(413, 'Upload must be at most 64 MiB')
  const existing = await bucket.head(key)
  if (existing) {
    await body.cancel()
    return verifyStored(bucket, { key, etag: existing.etag, bytes, checksum }, contentType)
  }
  const fixed = lengthStream(bytes)
  const abort = new AbortController()
  const pumping = body.pipeTo(fixed.writable, { signal: abort.signal })
  // Attach rejection handling immediately; put and pipe run concurrently.
  const settled = pumping.then(() => null, error => error as unknown)
  try {
    const object = await bucket.put(key, fixed.readable, { sha256: checksum, onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType } })
    if (!object) {
      abort.abort()
      await settled
      const winner = await bucket.head(key)
      if (!winner) throw new ReviewError(409, 'Upload did not complete')
      return verifyStored(bucket, { key, etag: winner.etag, bytes, checksum }, contentType)
    }
    if (await settled !== null) throw new ReviewError(400, 'Upload length does not match the session')
    return verifyStored(bucket, { key, etag: object.etag, bytes, checksum }, contentType)
  } catch (error) {
    abort.abort(); await settled
    if (error instanceof ReviewError) throw error
    throw new ReviewError(400, 'Upload stream or checksum validation failed')
  }
}
export type IntakeAsset = { media_id: string; session_id: string; video_id: string; kind: 'source' | 'deliverable'; object_key: string; object_etag: string; checksum: string; bytes: number; content_type: string; duration_ms: number | null }
export function assetObject(asset: IntakeAsset): StoredObject { return { key: asset.object_key, etag: asset.object_etag, checksum: asset.checksum, bytes: asset.bytes } }
export class TrustedAssets {
  constructor(readonly store: ReviewStore, readonly bucket: R2Bucket) {}
  find(mediaId: string) { return this.store.one<IntakeAsset>('SELECT * FROM review_intake_assets WHERE media_id=?', mediaId) }
  async resolve(mediaId: string, videoId: string, kind: IntakeAsset['kind']) {
    const asset = await this.find(mediaId)
    if (!asset) return null
    if (asset.video_id !== videoId || asset.kind !== kind) throw new ReviewError(409, 'Media is bound to another video or purpose')
    await verifyStored(this.bucket, assetObject(asset), kind === 'source' ? 'application/octet-stream' : asset.content_type)
    return asset
  }
  async pair(videoId: string, sourceId: string, deliverableId: string) {
    const [source, deliverable] = await Promise.all([this.find(sourceId), this.find(deliverableId)])
    if (!source && !deliverable) return
    if (!source || !deliverable || source.kind !== 'source' || deliverable.kind !== 'deliverable' || source.video_id !== videoId || deliverable.video_id !== videoId || source.session_id !== deliverable.session_id) throw new ReviewError(409, 'Deliverable does not belong to this exact source upload')
  }
}
