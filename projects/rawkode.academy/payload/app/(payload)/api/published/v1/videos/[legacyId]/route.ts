import { createPublishedHandlers } from '../../../../../../../src/published/http'
import { publishedRuntime } from '../../../../../../../src/published/runtime'

const handlers = createPublishedHandlers(publishedRuntime)
// Next 16 passes route params as a Promise.
export async function GET(request: Request, { params }: { params: Promise<{ legacyId: string }> }) {
  const { legacyId } = await params
  return handlers.get(request, legacyId)
}
