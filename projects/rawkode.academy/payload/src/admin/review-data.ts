import { cache } from 'react'
import { cloudflare } from '../cloudflare'
import { countReviewQueue, isReviewManaged, listReviewQueue, needsStaff, type ReviewQueueRow, type ReviewQueueState } from '../review/queue'
import { ReviewStore } from '../review/store'

// Per-request cached, read-only review data for the nav badge, dashboard
// widget and Review queue view. Failures degrade to an empty, labelled state
// instead of breaking the whole admin shell.
export type ReviewSnapshot = {
	rows: ReviewQueueRow[]
	counts: Record<ReviewQueueState, number>
	needsStaff: number
	error: string | null
}

const empty = (): Record<ReviewQueueState, number> => ({ 'no-revision': 0, ready: 0, 'changes-requested': 0, approved: 0, published: 0 })

export const reviewSnapshot = cache(async (limit = 50): Promise<ReviewSnapshot> => {
	try {
		const store = new ReviewStore(cloudflare.env.D1)
		const [rows, counts] = await Promise.all([listReviewQueue(store, { limit }), countReviewQueue(store)])
		return { rows, counts, needsStaff: needsStaff(counts), error: null }
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'review snapshot failed', error: String(error) }))
		const counts = empty()
		return { rows: [], counts, needsStaff: 0, error: 'Review data is unavailable right now.' }
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
