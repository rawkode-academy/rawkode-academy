import { feedbackExport, feedbackHeaders } from '../../../../../src/review/feedback'
import { reviewFailure, videoIdFrom } from '../../../../../src/review/http'
import { reviewRuntime } from '../../../../../src/review/runtime'

export async function GET(request: Request) {
  try {
    const { service, actor } = await reviewRuntime(request)
    const { filename, csv } = await feedbackExport(service, actor, videoIdFrom(request), new URL(request.url).searchParams.get('revisionId') ?? '')
    return new Response(csv, { headers: feedbackHeaders(filename) })
  } catch (error) { return reviewFailure(error) }
}
