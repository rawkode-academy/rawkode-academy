import { reviewBackend } from '../../../../../src/review/runtime'
import { ReviewError } from '../../../../../src/review/contracts'
import { reviewFailure, videoIdFrom } from '../../../../../src/review/http'
import { mediaResponse } from '../../../../../src/review/media'
import { isStudioPublication } from '../../../../../src/review/studio-handoff'
export async function GET(request: Request) {
  try {
    const { store, bucket } = await reviewBackend()
    const publicationId = new URL(request.url).searchParams.get('publicationId') ?? ''
    const row = await store.one<{ object_key: string; object_etag: string; bytes: number; content_type: string }>('SELECT object_key,object_etag,bytes,content_type FROM review_publication_events WHERE id=? AND video_id=?', publicationId, videoIdFrom(request))
    if (!row) throw new ReviewError(404, 'Publication not found')
    // A Studio recording publishes its HLS on the content CDN. Its approved review.mp4
    // stays private and is never served from this origin.
    if (await isStudioPublication(store, row.object_key, row.object_etag)) throw new ReviewError(404, 'Publication not found')
    return await mediaResponse(request, bucket, row.object_key, true, { etag: row.object_etag, bytes: row.bytes, contentType: row.content_type })
  } catch (error) { return reviewFailure(error) }
}
export const HEAD = GET
