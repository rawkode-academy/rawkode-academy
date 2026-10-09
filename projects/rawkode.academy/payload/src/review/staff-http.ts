import { ReviewError, type ReviewActor } from './contracts'
import type { Payload, Where } from 'payload'
import type { ReviewStore } from './store'
import { currentReviewStates } from './queue'

const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
type Runtime = { payload: Payload; store: ReviewStore; actor: ReviewActor; origin: string }

function staff(actor: ReviewActor) {
  if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
}

function failure(error: unknown) {
  if (error instanceof ReviewError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders })
  return Response.json({ error: 'Staff review request failed' }, { status: 500, headers: privateHeaders })
}

function query(request: Request) {
  const value = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (value.length > 120) throw new ReviewError(400, 'Search is too long')
  return value
}

async function createVideoInput(request: Request) {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') throw new ReviewError(415, 'Use application/json')
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 16384) throw new ReviewError(413, 'Video target details are too large')
  const reader = request.body?.getReader()
  if (!reader) throw new ReviewError(400, 'Video target details are required')
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.length
    if (length > 16384) { await reader.cancel(); throw new ReviewError(413, 'Video target details are too large') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new ReviewError(400, 'Invalid JSON') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ReviewError(400, 'Video target details are required')
  const input = value as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!title || title.length > 300) throw new ReviewError(400, 'A video title of 1–300 characters is required')
  if (!description || description.length > 8000) throw new ReviewError(400, 'A video description of 1–8000 characters is required')
  return { title, description }
}

function target(doc: Record<string, unknown>, reviewState = 'no-review') {
  return {
    videoId: Number(doc.id),
    legacyId: String(doc.legacyId),
    slug: String(doc.slug),
    title: typeof doc.title === 'string' && doc.title.trim() ? doc.title : String(doc.slug),
    description: typeof doc.description === 'string' ? doc.description : '',
    reviewState,
  }
}

export function createStaffVideoHandlers(runtime: (request: Request) => Promise<Runtime>) {
  return {
    async GET(request: Request) {
      try {
        const { payload, store, actor } = await runtime(request)
        staff(actor)
        const search = query(request)
        const where: Where = search ? {
          and: [
            { tombstone: { equals: false } },
            { or: [
              { title: { contains: search } },
              { slug: { contains: search } },
              { legacyId: { contains: search } },
            ] },
          ],
        } : { tombstone: { equals: false } }
        const result = await payload.find({
          collection: 'videos', depth: 0, draft: true, limit: 100, sort: '-updatedAt',
          where, overrideAccess: false, user: actor,
        })
        const reviewRows = await currentReviewStates(store)
        const reviewStates = new Map(reviewRows.map(row => [row.videoId, row.state ?? 'no-revision']))
        const videos = result.docs
          .filter(doc => !doc.tombstone && !doc.processingRun)
          .map(doc => target(doc as Record<string, unknown>, reviewStates.get(Number(doc.id)) ?? 'no-review'))
        return Response.json({ videos }, { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
    async POST(request: Request) {
      try {
        const { payload, actor, origin } = await runtime(request)
        staff(actor)
        if (request.headers.get('origin') !== origin) throw new ReviewError(403, 'Untrusted request origin')
        const input = await createVideoInput(request)
        const id = crypto.randomUUID()
        const doc = await payload.create({
          collection: 'videos', depth: 0, draft: true, overrideAccess: false, user: actor,
          data: {
            legacyId: `review-${id}`,
            legacyType: 'Video',
            slug: `review-${input.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'video'}-${id.slice(0, 8)}`,
            title: input.title,
            description: input.description,
            type: 'recorded',
            category: 'review',
            _status: 'draft',
            tombstone: false,
          },
        })
        return Response.json({ video: target(doc as Record<string, unknown>) }, { status: 201, headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}

export function createStaffReviewerHandlers(runtime: (request: Request) => Promise<Runtime>) {
  return {
    async GET(request: Request) {
      try {
        const { payload, actor } = await runtime(request)
        staff(actor)
        const search = query(request)
        const where: Where = search ? {
          and: [
            { role: { equals: 'customer' } },
            { or: [
              { name: { contains: search } },
              { profileEmail: { contains: search } },
            ] },
          ],
        } : { role: { equals: 'customer' } }
        const result = await payload.find({
          collection: 'users', depth: 0, limit: 100, sort: 'name',
          where, overrideAccess: false, user: actor,
        })
        const reviewers = result.docs.map(doc => ({
          userId: Number(doc.id),
          name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Academy customer',
          profileEmail: typeof doc.profileEmail === 'string' ? doc.profileEmail : '',
        }))
        return Response.json({ reviewers }, { headers: privateHeaders })
      } catch (error) { return failure(error) }
    },
  }
}
