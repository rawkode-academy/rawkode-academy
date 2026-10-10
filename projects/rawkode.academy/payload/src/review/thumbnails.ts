import { Buffer } from 'node:buffer'
import type { Payload } from 'payload'
import { ReviewError, type ReviewActor } from './contracts'
import { reviewFailure, videoIdFrom } from './http'
import { mediaResponse } from './media'
import type { ReviewService } from './service'
import type { ReviewStore } from './store'
import { createCuid2 } from '../cuid2'

export const maximumThumbnailBytes = 5 * 1024 * 1024
type ImageType = 'image/png' | 'image/jpeg' | 'image/webp'
export type ThumbnailAsset = { media_id: string; video_id: string; checksum: string; object_key: string; object_etag: string; bytes: number; content_type: ImageType }
type Runtime = { payload: Payload; store: ReviewStore; service: ReviewService; actor: ReviewActor; origin: string; bucket: R2Bucket }
const headers = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' }
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), byte => byte.toString(16).padStart(2, '0')).join('')

async function boundedBytes(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new ReviewError(400, 'A thumbnail file is required')
  const reader = body.getReader(), chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maximumThumbnailBytes) { await reader.cancel(); throw new ReviewError(413, 'Thumbnail must be 5 MiB or smaller') }
    chunks.push(value)
  }
  if (!length) throw new ReviewError(400, 'A thumbnail file is required')
  return Buffer.concat(chunks, length)
}
function dimensions(width: number, height: number) {
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216) throw new ReviewError(400, 'Thumbnail dimensions must be at most 8192 pixels and 16 megapixels')
}
function invalid(): never { throw new ReviewError(400, 'Invalid or truncated thumbnail image') }

// Validate the image container and dimensions without native image libraries.
// Compressed pixels are not decoded here; browsers still perform image decoding.
function imageType(bytes: Buffer): ImageType {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    let offset = 8, data = false, header = false
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8), end = offset + length + 12
      if (end > bytes.length || (!header && kind !== 'IHDR')) invalid()
      // PNG CRC covers the chunk name and contents.
      let crc = 0xffffffff
      for (let at = offset + 4; at < end - 4; at++) {
        crc ^= bytes[at]!
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
      }
      if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(end - 4)) invalid()
      if (kind === 'IHDR') {
        if (header || length !== 13) invalid()
        dimensions(bytes.readUInt32BE(offset + 8), bytes.readUInt32BE(offset + 12))
        const depth = bytes[offset + 16]!, color = bytes[offset + 17]!
        const depths: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] }
        if (!depths[color]?.includes(depth) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20]! > 1) invalid()
        header = true
      } else if (kind === 'IDAT') data ||= length > 0
      else if (kind === 'IEND') {
        if (length !== 0 || !data || end !== bytes.length) invalid()
        return 'image/png'
      }
      offset = end
    }
    invalid()
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2, frame = false, scan = false
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) invalid()
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xd9) {
        if (!frame || !scan || offset !== bytes.length) invalid()
        return 'image/jpeg'
      }
      if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || offset + 2 > bytes.length) invalid()
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || offset + length > bytes.length) invalid()
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8 || length !== 8 + 3 * bytes[offset + 7]!) invalid()
        dimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))
        frame = true
      }
      if (marker === 0xda) {
        if (!frame || length < 6 || length !== 6 + 2 * bytes[offset + 2]!) invalid()
        scan = true
        offset += length
        const start = offset
        while (offset < bytes.length) {
          if (bytes[offset] !== 0xff) { offset++; continue }
          if (bytes[offset + 1] === 0 || (bytes[offset + 1]! >= 0xd0 && bytes[offset + 1]! <= 0xd7)) { offset += 2; continue }
          break
        }
        if (offset === start) invalid()
      } else offset += length
    }
    invalid()
  }
  if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (bytes.readUInt32LE(4) + 8 !== bytes.length) invalid()
    let offset = 12, image = false
    while (offset + 8 <= bytes.length) {
      const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8
      const end = start + length + (length % 2)
      if (end > bytes.length) invalid()
      if (kind === 'VP8 ') {
        if (image || length < 10 || (bytes[start]! & 1) !== 0 || !bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d,1,0x2a]))) invalid()
        dimensions(bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff)
        image = true
      } else if (kind === 'VP8L') {
        if (image || length < 5 || bytes[start] !== 0x2f || bytes[start + 4]! >> 5) invalid()
        const bits = bytes.readUInt32LE(start + 1)
        dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
        image = true
      } else if (kind === 'VP8X') {
        if (offset !== 12 || length !== 10 || (bytes[start]! & 0x02)) invalid()
        dimensions(bytes.readUIntLE(start + 4, 3) + 1, bytes.readUIntLE(start + 7, 3) + 1)
      } else if (kind === 'ANIM' || kind === 'ANMF') invalid()
      offset = end
    }
    if (!image || offset !== bytes.length) invalid()
    return 'image/webp'
  }
  invalid()
}
export async function assertThumbnail(store: ReviewStore, videoId: string, thumbnailId: string): Promise<ThumbnailAsset> {
  if (!/^[a-z][a-z0-9]{23}$/.test(thumbnailId)) throw new ReviewError(400, 'Invalid thumbnail identifier')
  const asset = await store.one<ThumbnailAsset>('SELECT * FROM review_thumbnail_assets WHERE media_id=? AND video_id=?', thumbnailId, videoId)
  if (!asset) throw new ReviewError(404, 'Thumbnail not found for this video')
  return asset
}
async function verifyAsset(bucket: R2Bucket, asset: ThumbnailAsset) {
  const head = await bucket.head(asset.object_key)
  if (!head || head.etag !== asset.object_etag || head.size !== asset.bytes || head.httpMetadata?.contentType !== asset.content_type) throw new ReviewError(409, 'Immutable thumbnail object changed')
}

export function createThumbnailHandlers(runtime: (request: Request) => Promise<Runtime>) {
  const GET = async (request: Request) => {
    try {
      const { service, actor, store, bucket } = await runtime(request)
      const videoId = videoIdFrom(request)
      const revision = await service.revision(videoId, new URL(request.url).searchParams.get('revisionId') ?? '', actor)
      const thumbnailId: unknown = JSON.parse(revision.metadata).thumbnailId
      if (typeof thumbnailId !== 'string') throw new ReviewError(404, 'This revision has no thumbnail')
      const asset = await assertThumbnail(store, videoId, thumbnailId)
      await verifyAsset(bucket, asset)
      return await mediaResponse(request, bucket, asset.object_key, false, { etag: asset.object_etag, bytes: asset.bytes, contentType: asset.content_type })
    } catch (error) { return reviewFailure(error) }
  }
  return {
    GET, HEAD: GET,
    async POST(request: Request) {
      try {
        const { payload, store, service, actor, origin, bucket } = await runtime(request)
        if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
        if (request.headers.get('origin') !== origin) throw new ReviewError(403, 'Untrusted request origin')
        const videoId = videoIdFrom(request)
        await service.dependencies.video(videoId, actor)
        const claimed = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(claimed ?? '')) throw new ReviewError(415, 'Choose a PNG, JPEG, or WebP thumbnail')
        if (Number(request.headers.get('content-length') ?? 0) > maximumThumbnailBytes) throw new ReviewError(413, 'Thumbnail must be 5 MiB or smaller')
        const bytes = await boundedBytes(request.body), type = imageType(bytes)
        if (type !== claimed) throw new ReviewError(415, 'Thumbnail content does not match its declared type')
        const checksum = await digest(bytes)
        const prior = () => store.one<ThumbnailAsset>('SELECT * FROM review_thumbnail_assets WHERE video_id=? AND checksum=?', videoId, checksum)
        const existing = await prior()
        if (existing) {
          await verifyAsset(bucket, existing)
          return Response.json({ thumbnailId: existing.media_id, videoId }, { headers })
        }
        const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1]
        const media = await payload.create({
          collection: 'media', depth: 0, overrideAccess: false, user: actor,
          data: { alt: 'Private review thumbnail' },
          file: { data: bytes, size: bytes.length, mimetype: type, name: `review-thumbnail-${createCuid2()}.${extension}` },
        })
        if (typeof media.filename !== 'string' || !media.filename) throw new ReviewError(500, 'Thumbnail storage did not return an object')
        const head = await bucket.head(media.filename)
        if (!head || head.size !== bytes.length || head.httpMetadata?.contentType !== type) throw new ReviewError(409, 'Stored thumbnail does not match the upload')
        const object = await bucket.get(media.filename, { onlyIf: { etagMatches: head.etag } })
        if (!object || !('body' in object) || await digest(await boundedBytes(object.body)) !== checksum) throw new ReviewError(409, 'Stored thumbnail checksum does not match the upload')
        await store.db.prepare('INSERT INTO review_thumbnail_assets(media_id,video_id,checksum,object_key,object_etag,bytes,content_type) VALUES(?,?,?,?,?,?,?) ON CONFLICT(video_id,checksum) DO NOTHING')
          .bind(String(media.id), videoId, checksum, media.filename, head.etag, bytes.length, type).run()
        const saved = await prior()
        if (!saved) throw new ReviewError(500, 'Thumbnail association was not saved')
        await verifyAsset(bucket, saved)
        return Response.json({ thumbnailId: saved.media_id, videoId }, { status: 201, headers })
      } catch (error) { return reviewFailure(error) }
    },
  }
}
