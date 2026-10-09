import type { Payload } from 'payload'
import { cache } from 'react'
import { isSystemIdentity } from '../machine-auth'
import { cloudflare } from '../cloudflare'
import { broadcastCalendar, countQueueStatuses, isReviewManaged, listReviewQueue, needsStaff, type BroadcastRow, type QueueStatus, type ReviewQueueRow } from '../review/queue'
import { ReviewStore } from '../review/store'
import { publicationAvailability } from '../review/publication'
import type { StudioBindings } from '../review/studio-content'
import { authConfig } from '../auth/config'

// Per-request cached, read-only review data for the nav badge, dashboard
// widget and Review queue view. Failures degrade to an empty, labelled state
// instead of breaking the whole admin shell. Callers check isStaff first.
export type ReviewSnapshot = {
	rows: ReviewQueueRow[]
	counts: Record<QueueStatus, number>
	needsStaff: number
	broadcasts: BroadcastRow[]
	error: string | null
}

const empty = () => countQueueStatuses([])
// Staff-action rows first, then the oldest cut.
const priority = (row: ReviewQueueRow) => {
	const order: QueueStatus[] = ['ready-to-publish', 'changes-requested', 'approval-invalidated', 'approved-open-comments', 'needs-share', 'no-revision', 'processing', 'awaiting-client', 'published']
	return order.indexOf(row.status)
}

export const reviewSnapshot = cache(async (limit = 50): Promise<ReviewSnapshot> => {
	try {
		const store = new ReviewStore(cloudflare.env.D1)
		// Reviewed videos are few, so every row is derived once and counted.
		const rows: ReviewQueueRow[] = []
		let after = 0
		for (let page = 0; page < 10; page += 1) {
			const result = await listReviewQueue(store, { after, limit: 200 })
			rows.push(...result.items)
			if (result.nextCursor === null) break
			after = result.nextCursor
		}
		const counts = countQueueStatuses(rows)
		const sorted = [...rows].sort((a, b) => priority(a) - priority(b) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || a.videoId - b.videoId)
		const broadcasts = await broadcastCalendar(store)
		return { rows: sorted.slice(0, limit), counts, needsStaff: needsStaff(counts), broadcasts, error: null }
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'review snapshot failed', error: String(error) }))
		return { rows: [], counts: empty(), needsStaff: 0, broadcasts: [], error: 'Review data is unavailable right now.' }
	}
})

// The same publish availability as reviewBackend(), without booting the review
// runtime: Publish is offered only when the approved deliverable can be released.
export const publicationAvailable = cache(async (videoId: number): Promise<boolean> => {
	try {
		const env = cloudflare.env as CloudflareEnv & StudioBindings & { POC_REVIEW_FIXTURE_MEDIA?: string }
		const fixture = authConfig(cloudflare.env).local && env.POC_REVIEW_FIXTURE_MEDIA === 'true'
		return await publicationAvailability(new ReviewStore(cloudflare.env.D1), { fixture, studio: Boolean(env.STUDIO_CONTENT) })(videoId)
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'publication availability failed', error: String(error) }))
		return false
	}
})

// Assign picker options: people with the staff role, never system principals.
export const staffDirectory = cache(async (payload: Payload): Promise<{ id: number; name: string }[]> => {
	try {
		const result = await payload.find({ collection: 'users', depth: 0, limit: 200, sort: 'name', where: { role: { equals: 'staff' } }, overrideAccess: true })
		return result.docs
			.filter(doc => !isSystemIdentity((doc as { identityKey?: unknown }).identityKey))
			.map(doc => ({ id: Number(doc.id), name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : `Staff ${doc.id}` }))
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'staff directory failed', error: String(error) }))
		return []
	}
})

// Shared by the edit-view notice and the Save/Publish slots in one request.
// Fails open: on error the normal buttons render and the database triggers
// still refuse the write.
export const videoInReview = cache(async (videoId: number): Promise<boolean> => {
	if (!Number.isFinite(videoId)) return false
	try {
		return await isReviewManaged(new ReviewStore(cloudflare.env.D1), videoId)
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'review membership check failed', error: String(error) }))
		return false
	}
})
