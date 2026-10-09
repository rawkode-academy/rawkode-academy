import { ReviewError, type ReviewActor } from './contracts'
import { reviewFailure } from './http'
import { broadcastCalendar, queueStatuses, reviewQueue, type QueueFilters, type QueueStatus } from './queue'
import type { ReviewStore } from './store'

const privateHeaders = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' }
type Runtime = { store: ReviewStore; actor: ReviewActor; publicationAvailable?: (videoId: number) => Promise<boolean>; now?: () => Date }

export function queueFilters(params: URLSearchParams): QueueFilters {
  const filters: QueueFilters = {}
  const status = params.get('status')
  if (status !== null) {
    if (!(queueStatuses as readonly string[]).includes(status)) throw new ReviewError(400, 'Invalid queue status')
    filters.status = status as QueueStatus
  }
  const assignee = params.get('assignee')
  if (assignee !== null && assignee !== 'all') {
    if (assignee === 'me' || assignee === 'unassigned') filters.assignee = assignee
    else if (/^[1-9]\d{0,15}$/.test(assignee) && Number.isSafeInteger(Number(assignee))) filters.assignee = Number(assignee)
    else throw new ReviewError(400, 'Invalid assignee filter')
  }
  const after = params.get('after')
  if (after !== null) {
    if (!/^(0|[1-9]\d{0,15})$/.test(after) || !Number.isSafeInteger(Number(after))) throw new ReviewError(400, 'Invalid queue cursor')
    filters.after = Number(after)
  }
  return filters
}

// Staff-only queue API for the admin view's client actions. Admin host only: it is
// deliberately absent from the website bridge allowlist.
export function createQueueHandlers(runtime: (request: Request) => Promise<Runtime>) {
  return {
    async GET(request: Request) {
      try {
        const { store, actor, publicationAvailable, now } = await runtime(request)
        if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
        const filters = queueFilters(new URL(request.url).searchParams)
        const page = await reviewQueue(store, actor, filters, now)
        const items = await Promise.all(page.items.map(async item => ({
          ...item,
          // Only a publishable row needs the (per-video) deliverable check.
          publicationAvailable: item.status === 'ready-to-publish' && publicationAvailable ? await publicationAvailable(item.videoId) : false,
        })))
        const broadcasts = filters.after ? undefined : await broadcastCalendar(store, now)
        return Response.json({ items, nextCursor: page.nextCursor, ...(broadcasts ? { broadcasts } : {}) }, { headers: privateHeaders })
      } catch (error) { return reviewFailure(error) }
    },
  }
}
