import { ReviewError, type ReviewActor } from './contracts'
import type { Payload, Where } from 'payload'
import type { ReviewStore } from './store'

const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
type Runtime = { payload: Payload; store: ReviewStore; actor: ReviewActor }

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
        const reviewRows = await store.all<{ videoId: number; state: string }>(
          `SELECT s.video_id AS videoId,r.state
           FROM video_review_state s LEFT JOIN video_revisions r ON r.id=s.current_revision
           ORDER BY s.video_id`,
        )
        const reviewStates = new Map(reviewRows.map(row => [row.videoId, row.state ?? 'no-revision']))
        const videos = result.docs
          .filter(doc => !doc.tombstone && !doc.processingRun)
          .map(doc => ({
            videoId: Number(doc.id),
            legacyId: String(doc.legacyId),
            slug: String(doc.slug),
            title: typeof doc.title === 'string' && doc.title.trim() ? doc.title : String(doc.slug),
            description: typeof doc.description === 'string' ? doc.description : '',
            reviewState: reviewStates.get(Number(doc.id)) ?? 'no-review',
          }))
        return Response.json({ videos }, { headers: privateHeaders })
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
