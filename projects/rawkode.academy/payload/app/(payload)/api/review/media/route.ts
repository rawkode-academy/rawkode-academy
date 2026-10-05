import { boundedObject } from '../../../../../src/review/artifacts'
import { ReviewError } from '../../../../../src/review/contracts'
import { reviewRuntime, deliveryKey } from '../../../../../src/review/runtime'
import { reviewFailure, videoIdFrom } from '../../../../../src/review/http'
import { mediaResponse } from '../../../../../src/review/media'
export async function GET(request: Request) {
  try {
    const { service, actor, payload, bucket } = await reviewRuntime(request)
    const revision = await service.revision(videoIdFrom(request), new URL(request.url).searchParams.get('revisionId') ?? '', actor)
    const key = await deliveryKey(payload, revision.deliverable_media_id)
    const verified = await boundedObject(bucket, key)
    if (verified.checksum !== revision.deliverable_checksum) throw new ReviewError(409, 'Review deliverable changed')
    return await mediaResponse(request, bucket, key, false, { etag: verified.etag, bytes: verified.bytes.byteLength, contentType: 'video/mp4' })
  } catch (error) { return reviewFailure(error) }
}
export const HEAD = GET
