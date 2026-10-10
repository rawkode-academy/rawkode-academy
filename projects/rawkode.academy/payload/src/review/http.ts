import { ReviewError, type ReviewActor } from './contracts'
import type { ReviewService } from './service'

export type ReviewRuntime = { service: ReviewService; actor: ReviewActor; origin: string; publicationAvailable?: boolean | ((videoId: string) => Promise<boolean>) }
const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
export function reviewFailure(error: unknown): Response {
  if (error instanceof ReviewError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders })
  return Response.json({ error: 'Review request failed' }, { status: 500, headers: privateHeaders })
}
export function videoIdFrom(request: Request): string {
  const value = new URL(request.url).searchParams.get('videoId')
  if (!value || !/^[a-z][a-z0-9]{23}$/.test(value)) throw new ReviewError(400, 'A videoId is required')
  return value
}
export async function readCommand(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new ReviewError(400, 'A JSON command is required')
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.length
    if (length > 262144) { await reader.cancel(); throw new ReviewError(413, 'Review command is too large') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new ReviewError(400, 'Invalid JSON command') }
}
export function createReviewHandlers(runtime: (request: Request) => Promise<ReviewRuntime>) {
  return {
    async GET(request: Request) {
      try {
        const { service, actor, publicationAvailable = false } = await runtime(request)
        const params = new URL(request.url).searchParams
        if (!params.has('videoId')) {
          const after = params.get('after')
          if (after && !/^[a-z][a-z0-9]{23}$/.test(after)) throw new ReviewError(400, 'Invalid review cursor')
          return Response.json(await service.list(actor, after), { headers: privateHeaders })
        }
        const videoId = videoIdFrom(request)
        const review = await service.read(videoId, actor)
        return Response.json({ ...review, publicationAvailable: typeof publicationAvailable === 'function' ? await publicationAvailable(videoId) : publicationAvailable }, { headers: privateHeaders })
      } catch (error) { return reviewFailure(error) }
    },
    async POST(request: Request) {
      try {
        const { service, actor, origin } = await runtime(request)
        if (request.headers.get('origin') !== origin) throw new ReviewError(403, 'Untrusted request origin')
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ReviewError(415, 'Use application/json')
        return Response.json(await service.execute(actor, await readCommand(request)), { headers: privateHeaders })
      } catch (error) { return reviewFailure(error) }
    },
  }
}
