import { ReviewAccess } from './access'
import type { ReviewStore } from './store'

// Read-only projections of the review tables for staff surfaces (the staff
// video picker, the admin Review queue, the dashboard widget and the nav
// badge). Nothing here writes; commands stay in ReviewService.

export type ReviewStateRow = { videoId: string; state: string | null }

export type ReviewQueueRow = {
	videoId: string
	videoTitle: string | null
	videoSlug: string | null
	revisionId: string | null
	revisionTitle: string | null
	state: string | null
	reviewVersion: number | null
	createdAt: string | null
	openComments: number
	activeReviewers: number
	latestDecision: string | null
	latestDecisionAt: string | null
}

export type ReviewQueueState = 'no-revision' | 'ready' | 'changes-requested' | 'approved' | 'published'

export const reviewStateLabels: Record<ReviewQueueState, string> = {
	'no-revision': 'No cut uploaded',
	ready: 'Awaiting client',
	'changes-requested': 'Changes requested',
	approved: 'Approved, ready to publish',
	published: 'Published',
}

// States where the next step belongs to staff rather than the client.
export const staffActionStates: readonly ReviewQueueState[] = ['no-revision', 'changes-requested', 'approved']

export const queueState = (state: string | null): ReviewQueueState => (state && state in reviewStateLabels ? (state as ReviewQueueState) : 'no-revision')

export function currentReviewStates(store: ReviewStore): Promise<ReviewStateRow[]> {
	return store.all<ReviewStateRow>(
		`SELECT s.video_id AS videoId,r.state
		 FROM video_review_state s LEFT JOIN video_revisions r ON r.id=s.current_revision
		 ORDER BY s.video_id`,
	)
}

export function listReviewQueue(store: ReviewStore, { limit = 50 }: { limit?: number } = {}): Promise<ReviewQueueRow[]> {
	const bounded = Math.max(1, Math.min(200, Math.trunc(limit)))
	const reviewers = new ReviewAccess(store).activeReviewersSubquery('s.video_id')
	return store.all<ReviewQueueRow>(
		`SELECT s.video_id AS videoId,v.title AS videoTitle,v.slug AS videoSlug,
		   r.id AS revisionId,json_extract(r.metadata,'$.title') AS revisionTitle,r.state,
		   r.review_version AS reviewVersion,r.created_at AS createdAt,
		   (SELECT COUNT(*) FROM review_comments c WHERE c.revision_id=r.id AND c.resolved=0) AS openComments,
		   ${reviewers.sql} AS activeReviewers,
		   (SELECT d.decision FROM review_decisions d WHERE d.video_id=s.video_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1) AS latestDecision,
		   (SELECT d.created_at FROM review_decisions d WHERE d.video_id=s.video_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1) AS latestDecisionAt
		 FROM video_review_state s
		 LEFT JOIN video_revisions r ON r.id=s.current_revision
		 LEFT JOIN videos v ON v.id=s.video_id
		 ORDER BY CASE WHEN r.state='published' THEN 1 ELSE 0 END,COALESCE(r.created_at,'') ASC,s.video_id ASC
		 LIMIT ?`,
		...reviewers.params,
		bounded,
	)
}

export async function countReviewQueue(store: ReviewStore): Promise<Record<ReviewQueueState, number>> {
	const rows = await store.all<{ state: string | null; total: number }>(
		`SELECT r.state,COUNT(*) AS total
		 FROM video_review_state s LEFT JOIN video_revisions r ON r.id=s.current_revision
		 GROUP BY r.state`,
	)
	const counts = countReviewStates([])
	for (const row of rows) counts[queueState(row.state)] += Number(row.total)
	return counts
}

export function countReviewStates(rows: readonly { state: string | null }[]): Record<ReviewQueueState, number> {
	const counts: Record<ReviewQueueState, number> = { 'no-revision': 0, ready: 0, 'changes-requested': 0, approved: 0, published: 0 }
	for (const row of rows) counts[queueState(row.state)] += 1
	return counts
}

export const needsStaff = (counts: Record<ReviewQueueState, number>): number => staffActionStates.reduce((total, state) => total + counts[state], 0)

// Any video_review_state row makes the video managed: the review_freeze_*
// triggers then reject every Payload write to it and its child tables.
export async function isReviewManaged(store: ReviewStore, videoId: string): Promise<boolean> {
	return Boolean(await store.one<{ managed: number }>('SELECT 1 AS managed FROM video_review_state WHERE video_id=?', videoId))
}

export type ReviewHistory = {
	currentRevisionId: string | null
	revisions: { id: string; state: string; reviewVersion: number; createdAt: string; title: string | null }[]
	openComments: number
	decisions: { id: string; revisionId: string; decision: string; note: string; createdAt: string }[]
	activeReviewers: number
}

// Read-only history for one video's Review tab. Grant rows are counted, never
// returned, so no reviewer identities or grant state reach form state.
export async function reviewHistory(store: ReviewStore, videoId: string): Promise<ReviewHistory | null> {
	const state = await store.one<{ current_revision: string | null }>('SELECT current_revision FROM video_review_state WHERE video_id=?', videoId)
	if (!state) return null
	const [revisions, comments, decisions, reviewers] = await Promise.all([
		store.all<ReviewHistory['revisions'][number]>(
			`SELECT id,state,review_version AS reviewVersion,created_at AS createdAt,json_extract(metadata,'$.title') AS title
			 FROM video_revisions WHERE video_id=? ORDER BY created_at DESC,id DESC LIMIT 10`,
			videoId,
		),
		// Current revision only, matching the queue and the publish guard.
		store.one<{ total: number }>('SELECT COUNT(*) AS total FROM review_comments WHERE revision_id=? AND resolved=0', state.current_revision),
		store.all<ReviewHistory['decisions'][number]>(
			`SELECT id,revision_id AS revisionId,decision,note,created_at AS createdAt
			 FROM review_decisions WHERE video_id=? ORDER BY created_at DESC,id DESC LIMIT 5`,
			videoId,
		),
		new ReviewAccess(store).activeReviewerCount(videoId),
	])
	return {
		currentRevisionId: state.current_revision,
		revisions,
		openComments: Number(comments?.total ?? 0),
		decisions,
		activeReviewers: reviewers,
	}
}
