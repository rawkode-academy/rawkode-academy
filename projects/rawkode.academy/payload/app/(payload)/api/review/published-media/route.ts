import { reviewBackend } from '../../../../../src/review/runtime'
import { reviewFailure, videoIdFrom } from '../../../../../src/review/http'
import { publishedMediaResponse } from '../../../../../src/review/media'
export async function GET(request: Request) {
  try {
    const { payload, store, bucket } = await reviewBackend()
    const publicationId = new URL(request.url).searchParams.get('publicationId') ?? ''
    return await publishedMediaResponse(request, payload, store, bucket, videoIdFrom(request), publicationId)
  } catch (error) { return reviewFailure(error) }
}
export const HEAD = GET
