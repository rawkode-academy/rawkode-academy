import { createPublishedHandlers } from '../../../../../../src/published/http'
import { publishedRuntime } from '../../../../../../src/published/runtime'

// Reached only through the PublishedContent service binding entrypoint (worker.ts);
// src/ingress.ts answers 404 for /api/published/ on every public host.
const handlers = createPublishedHandlers(publishedRuntime)
export async function GET(request: Request) {
  return handlers.list(request)
}
