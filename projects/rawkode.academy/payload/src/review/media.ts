import { ReviewError } from './contracts'

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
