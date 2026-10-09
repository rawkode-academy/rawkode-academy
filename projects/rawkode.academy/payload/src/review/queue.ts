import { ReviewAccess } from './access'
import { ReviewError, type ReviewActor } from './contracts'
import type { ReviewStore } from './store'
import { effectiveTimes, type EditorialTimesV1, type TimesRow } from '../editorial/effective'

// Read-only projections of the review tables for staff surfaces (the staff
// video picker, the admin Review queue and its API, the dashboard widget, the
// nav badge and the broadcast calendar). Nothing here writes; commands stay in
// ReviewService and EditorialTimes.

export type ReviewStateRow = { videoId: number; state: string | null }

export function currentReviewStates(store: ReviewStore): Promise<ReviewStateRow[]> {
	return store.all<ReviewStateRow>(
		`SELECT s.video_id AS videoId,r.state
		 FROM video_review_state s LEFT JOIN video_revisions r ON r.id=s.current_revision
		 ORDER BY s.video_id`,
	)
}

// Revision states as stored on video_revisions, for per-revision pills.
export type ReviewQueueState = 'no-revision' | 'ready' | 'changes-requested' | 'approved' | 'published'

export const reviewStateLabels: Record<ReviewQueueState, string> = {
	'no-revision': 'No cut uploaded',
	ready: 'Awaiting client',
	'changes-requested': 'Changes requested',
	approved: 'Approved',
	published: 'Published',
}

export const queueState = (state: string | null): ReviewQueueState => (state && state in reviewStateLabels ? (state as ReviewQueueState) : 'no-revision')

// The staff queue status of a video, derived from its current revision, the
// combined approver outcome (ReviewAccess team state), grants, comments, pending
// processing and the stored approval. Checked in order by deriveQueueStatus.
export const queueStatuses = [
	'processing',
	'no-revision',
	'published',
	'changes-requested',
	'approved-open-comments',
	'ready-to-publish',
	'approval-invalidated',
	'needs-share',
	'awaiting-client',
] as const
export type QueueStatus = (typeof queueStatuses)[number]

export const queueStatusLabels: Record<QueueStatus, string> = {
	processing: 'Processing a cut',
	'no-revision': 'No cut uploaded',
	published: 'Published',
	'changes-requested': 'Changes requested',
	'approved-open-comments': 'Approved, open comments',
	'ready-to-publish': 'Ready to publish',
	'approval-invalidated': 'Approval invalidated',
	'needs-share': 'Needs sharing',
	'awaiting-client': 'Awaiting client',
}

// Statuses where the next step belongs to staff rather than the client.
export const staffActionStatuses: readonly QueueStatus[] = ['no-revision', 'needs-share', 'changes-requested', 'approved-open-comments', 'ready-to-publish', 'approval-invalidated']

export type QueueStatusInput = {
	processing: boolean
	revisionId: string | null
	revisionState: string | null
	teamState: string | null
	approverCount: number
	openComments: number
	approvedDecisionId: string | null
}

export function deriveQueueStatus(row: QueueStatusInput): QueueStatus {
	if (row.processing) return 'processing'
	if (!row.revisionId) return 'no-revision'
	if (row.revisionState === 'published') return 'published'
	if (row.teamState === 'changes-requested') return 'changes-requested'
	if (row.teamState === 'approved') {
		if (row.openComments > 0) return 'approved-open-comments'
		return row.approvedDecisionId ? 'ready-to-publish' : 'approval-invalidated'
	}
	// The stored state keeps the first approval; a revoked or changed approving grant
	// voids it, matching the publish guard in ReviewService.
	if (row.revisionState === 'approved') return 'approval-invalidated'
	if (row.approverCount === 0) return 'needs-share'
	return 'awaiting-client'
}

export type ReviewQueueRow = {
	videoId: number
	videoTitle: string | null
	videoSlug: string | null
	legacyId: string | null
	revisionId: string | null
	revisionTitle: string | null
	revisionState: string | null
	reviewVersion: number | null
	createdAt: string | null
	status: QueueStatus
	openComments: number
	approverCount: number
	activeReviewers: number
	decisionId: string | null
	latestDecision: string | null
	latestDecisionAt: string | null
	assignee: { id: number; name: string } | null
	assignmentVersion: number
	times: EditorialTimesV1
}

type QueueSqlRow = Omit<ReviewQueueRow, 'status' | 'assignee' | 'times' | 'decisionId'> & {
	teamState: string | null
	approvedDecisionId: string | null
	processing: number
	assigneeId: number | null
	assigneeName: string | null
	videoType: string | null
	videoStatus: string | null
	videoPublishedAt: string | null
} & Pick<TimesRow, 'scheduled_start_at' | 'broadcast_started_at' | 'broadcast_ended_at' | 'published_at'>

export type QueueFilters = { status?: QueueStatus; assignee?: 'me' | 'unassigned' | number; after?: number; limit?: number }
export type QueuePage = { items: ReviewQueueRow[]; nextCursor: number | null }

function staffOnly(actor: ReviewActor) {
	if (actor.role !== 'staff') throw new ReviewError(403, 'Staff access required')
}

export async function reviewQueue(store: ReviewStore, actor: ReviewActor, filters: QueueFilters = {}, now: () => Date = () => new Date()): Promise<QueuePage> {
	staffOnly(actor)
	return listReviewQueue(store, { ...filters, assignee: filters.assignee === 'me' ? actor.id : filters.assignee }, now)
}

// One query, cursor-paginated by video id. Grant-derived columns come from
// ReviewAccess, the only module that names the grant table. The status filter is
// applied after derivation, so a filtered page may hold fewer than limit items.
// Callers must already have checked for staff (reviewQueue, or an admin server
// component guarded by isStaff).
export async function listReviewQueue(store: ReviewStore, filters: Omit<QueueFilters, 'assignee'> & { assignee?: 'unassigned' | number } = {}, now: () => Date = () => new Date()): Promise<QueuePage> {
	const limit = Math.max(1, Math.min(200, Math.trunc(filters.limit ?? 50)))
	const columns = new ReviewAccess(store, now).queueColumns('r', 's.video_id')
	const assignee = filters.assignee === 'unassigned' ? { sql: ' AND a.assignee_id IS NULL', values: [] } : filters.assignee === undefined ? { sql: '', values: [] } : { sql: ' AND a.assignee_id=?', values: [filters.assignee] }
	const rows = await store.all<QueueSqlRow>(
		`SELECT s.video_id AS videoId,v.title AS videoTitle,v.slug AS videoSlug,v.legacy_id AS legacyId,
		   v.type AS videoType,v._status AS videoStatus,v.published_at AS videoPublishedAt,
		   r.id AS revisionId,json_extract(r.metadata,'$.title') AS revisionTitle,r.state AS revisionState,
		   r.review_version AS reviewVersion,r.created_at AS createdAt,
		   (SELECT COUNT(*) FROM review_comments c WHERE c.revision_id=r.id AND c.resolved=0) AS openComments,
		   ${columns.sql},
		   (SELECT d.decision FROM review_decisions d WHERE d.video_id=s.video_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1) AS latestDecision,
		   (SELECT d.created_at FROM review_decisions d WHERE d.video_id=s.video_id ORDER BY d.created_at DESC,d.id DESC LIMIT 1) AS latestDecisionAt,
		   (EXISTS(SELECT 1 FROM review_upload_sessions us JOIN review_processing_jobs j ON j.session_id=us.id
		      WHERE us.video_id=s.video_id AND j.completed_at IS NULL AND json_extract(j.manifest,'$.deadline')>? AND json_extract(j.manifest,'$.expectedCurrentRevisionId') IS s.current_revision)
		    OR EXISTS(SELECT 1 FROM review_studio_adoptions sa WHERE sa.video_id=s.video_id AND sa.state='awaiting-transcode' AND sa.expected_current_revision IS s.current_revision)) AS processing,
		   a.assignee_id AS assigneeId,u.name AS assigneeName,COALESCE(a.version,0) AS assignmentVersion,
		   t.scheduled_start_at,t.broadcast_started_at,t.broadcast_ended_at,t.published_at
		 FROM video_review_state s
		 LEFT JOIN video_revisions r ON r.id=s.current_revision
		 LEFT JOIN videos v ON v.id=s.video_id
		 LEFT JOIN review_assignments a ON a.video_id=s.video_id
		 LEFT JOIN users u ON u.id=a.assignee_id
		 LEFT JOIN video_editorial_times t ON t.id=s.video_id
		 WHERE s.video_id>?${assignee.sql}
		 ORDER BY s.video_id LIMIT ?`,
		...columns.values,
		Math.floor(now().getTime() / 1000),
		filters.after ?? 0,
		...assignee.values,
		limit + 1,
	)
	const items = rows.slice(0, limit).map(row => {
		const status = deriveQueueStatus({ ...row, processing: Boolean(row.processing), openComments: Number(row.openComments), approverCount: Number(row.approverCount) })
		return {
			videoId: row.videoId,
			videoTitle: row.videoTitle,
			videoSlug: row.videoSlug,
			legacyId: row.legacyId,
			revisionId: row.revisionId,
			revisionTitle: row.revisionTitle,
			revisionState: row.revisionState,
			reviewVersion: row.reviewVersion,
			createdAt: row.createdAt,
			status,
			openComments: Number(row.openComments),
			approverCount: Number(row.approverCount),
			activeReviewers: Number(row.activeReviewers),
			decisionId: status === 'ready-to-publish' ? row.approvedDecisionId : null,
			latestDecision: row.latestDecision,
			latestDecisionAt: row.latestDecisionAt,
			assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName || `Staff ${row.assigneeId}` } : null,
			assignmentVersion: Number(row.assignmentVersion),
			times: effectiveTimes(row, { type: row.videoType, _status: row.videoStatus, publishedAt: row.videoPublishedAt }),
		}
	})
	return {
		items: filters.status ? items.filter(item => item.status === filters.status) : items,
		nextCursor: rows.length > limit ? items.at(-1)!.videoId : null,
	}
}

// One video's queue row (the video Review tab). Callers must already have checked for staff.
export async function reviewQueueRow(store: ReviewStore, videoId: number, now: () => Date = () => new Date()): Promise<ReviewQueueRow | null> {
	const row = (await listReviewQueue(store, { after: videoId - 1, limit: 1 }, now)).items[0]
	return row?.videoId === videoId ? row : null
}

export function countQueueStatuses(rows: readonly { status: QueueStatus }[]): Record<QueueStatus, number> {
	const counts = Object.fromEntries(queueStatuses.map(status => [status, 0])) as Record<QueueStatus, number>
	for (const row of rows) counts[row.status] += 1
	return counts
}

export const needsStaff = (counts: Record<QueueStatus, number>): number => staffActionStatuses.reduce((total, status) => total + counts[status], 0)

export type BroadcastRow = {
	videoId: number
	title: string | null
	legacyId: string
	status: string | null
	version: number
	times: EditorialTimesV1
}

// Upcoming and running live videos, with or without review state: the stored
// schedule, or the legacy-live fallback (a live video's imported publishedAt).
// Broadcasts that started and never ended stay listed so staff can correct them.
export async function broadcastCalendar(store: ReviewStore, now: () => Date = () => new Date(), limit = 50): Promise<BroadcastRow[]> {
	const scheduled = "COALESCE(t.scheduled_start_at,strftime('%Y-%m-%dT%H:%M:%fZ',v.published_at))"
	const rows = await store.all<{ videoId: number; title: string | null; legacyId: string; status: string | null; type: string | null; publishedAt: string | null; version: number } & Pick<TimesRow, 'scheduled_start_at' | 'broadcast_started_at' | 'broadcast_ended_at' | 'published_at'>>(
		`SELECT v.id AS videoId,v.title,v.legacy_id AS legacyId,v._status AS status,v.type,v.published_at AS publishedAt,COALESCE(t.version,0) AS version,
		   t.scheduled_start_at,t.broadcast_started_at,t.broadcast_ended_at,t.published_at
		 FROM videos v LEFT JOIN video_editorial_times t ON t.id=v.id
		 WHERE v.tombstone=0 AND v.type='live' AND t.broadcast_ended_at IS NULL
		   AND (t.broadcast_started_at IS NOT NULL OR ${scheduled}>=?)
		 ORDER BY COALESCE(t.broadcast_started_at,${scheduled}),v.id LIMIT ?`,
		new Date(now().getTime() - 12 * 3600 * 1000).toISOString(),
		Math.max(1, Math.min(200, Math.trunc(limit))),
	)
	return rows.map(row => ({ videoId: row.videoId, title: row.title, legacyId: row.legacyId, status: row.status, version: Number(row.version), times: effectiveTimes(row, { type: row.type, _status: row.status, publishedAt: row.publishedAt }) }))
}

// Any video_review_state row makes the video managed: the review_freeze_*
// triggers then reject every Payload write to it and its child tables.
export async function isReviewManaged(store: ReviewStore, videoId: number): Promise<boolean> {
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
export async function reviewHistory(store: ReviewStore, videoId: number): Promise<ReviewHistory | null> {
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
