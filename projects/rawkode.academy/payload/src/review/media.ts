import { ReviewError } from './contracts'
import type { Payload } from 'payload'
import { isCuid2 } from '../cuid2'
import { isVisibleDocument } from '../public-content-bridge'

type PublicMediaStore = { one<T>(query: string, ...values: (string | number | null)[]): Promise<T | null> }

export function byteRange(header: string | null, size: number): { offset: number; length: number } | undefined {
  if (!header) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) throw new ReviewError(416, 'Unsupported byte range')
  const first = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const last = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 0 || first >= size || last < first) throw new ReviewError(416, 'Byte range is outside the media')
  return { offset: first, length: last - first + 1 }
}
export async function mediaResponse(request: Request, bucket: R2Bucket, key: string, isPublic = false, expected?: { etag: string; bytes: number; contentType: string }) {
  const head = await bucket.head(key)
  if (!head) throw new ReviewError(404, 'Media not found')
  if (expected && (head.etag !== expected.etag || head.size !== expected.bytes)) throw new ReviewError(409, 'Immutable release object changed')
  let range: ReturnType<typeof byteRange>
  try { range = byteRange(request.headers.get('range'), head.size) }
  catch (error) {
    if (error instanceof ReviewError && error.status === 416) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${head.size}`, 'cache-control': 'no-store' } })
    throw error
  }
  const headers = new Headers({
    'content-type': expected?.contentType ?? head.httpMetadata?.contentType ?? 'application/octet-stream',
    'content-length': String(range?.length ?? head.size), 'accept-ranges': 'bytes',
    'cache-control': isPublic ? 'public, max-age=300' : 'private, no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', etag: head.httpEtag,
  })
  if (range) headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers })
  const object = await bucket.get(key, { range, onlyIf: { etagMatches: head.etag } })
  if (!object || !('body' in object)) throw new ReviewError(409, 'Media changed during playback')
  return new Response(object.body, { status: range ? 206 : 200, headers })
}

/** Stream only the currently published public release, without a cache window past unpublish. */
export async function publishedMediaResponse(request: Request, payload: Pick<Payload, 'findByID'>, store: PublicMediaStore, bucket: R2Bucket, videoId: string, publicationId: string, now = Date.now()) {
  if (!isCuid2(videoId) || !isCuid2(publicationId)) throw new ReviewError(404, 'Publication not found')
  const video = await payload.findByID({
    collection: 'videos', id: videoId, depth: 0, draft: false, overrideAccess: true, user: null,
    select: { id: true, _status: true, tombstone: true, publishedAt: true, type: true },
  } as never).catch(() => null) as unknown as Record<string, unknown> | null
  const videoVisibility = video && isVisibleDocument('videos', video, now)
  if (!video || videoVisibility?.visible !== true || videoVisibility.metadataOnly) throw new ReviewError(404, 'Publication not found')

  const publicRow = await store.one<{ document: unknown }>('SELECT document FROM video_publications WHERE id=?', videoId)
  let projection: Record<string, unknown> | null = null
  try {
    const value = typeof publicRow?.document === 'string' ? JSON.parse(publicRow.document) : publicRow?.document
    if (value && typeof value === 'object') projection = value as Record<string, unknown>
  } catch { /* malformed stored projections are never public */ }
  if (!projection || String(projection.id) !== videoId || !isVisibleDocument('videos', projection, now).visible) throw new ReviewError(404, 'Publication not found')

  let projectedURL: URL
  try { projectedURL = new URL(String(projection.streamUrl), request.url) }
  catch { throw new ReviewError(404, 'Publication not found') }
  if (projectedURL.searchParams.get('videoId') !== videoId || projectedURL.searchParams.get('publicationId') !== publicationId) throw new ReviewError(404, 'Publication not found')

  const release = await store.one<{ object_key: string; object_etag: string; bytes: number; content_type: string; published_at: string }>(
    'SELECT object_key,object_etag,bytes,content_type,published_at FROM review_publication_events WHERE id=? AND video_id=?', publicationId, videoId)
  const projectionTime = Date.parse(String(projection.publishedAt ?? ''))
  const releaseTime = Date.parse(String(release?.published_at ?? ''))
  if (!release || !Number.isFinite(projectionTime) || projectionTime > now || releaseTime !== projectionTime) throw new ReviewError(404, 'Publication not found')

  const response = await mediaResponse(request, bucket, release.object_key, true, { etag: release.object_etag, bytes: release.bytes, contentType: release.content_type })
  const headers = new Headers(response.headers)
  // Unpublishing can happen at any time; browsers and shared caches must recheck every request.
  headers.set('cache-control', 'private, no-store')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
