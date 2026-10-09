import { Link } from '@payloadcms/ui'
import type { UIFieldServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { cloudflare } from '../../cloudflare'
import { reviewHistory, reviewQueueRow, type ReviewQueueRow } from '../../review/queue'
import { ReviewStore } from '../../review/store'
import { plural, timeAgo } from '../format'
import { collectionPath, previewReviewUrl, reviewQueuePath } from '../links'
import { publicationAvailable, staffDirectory } from '../review-data'
import { QueueStatusPill, ReviewStatePill } from '../views/ReviewStatePill'
import { ReviewActions } from './ReviewActions'

// Server-rendered Review tab for a video, deliberately not join fields: no extra
// subqueries on public reads and no grant data in form state. The guarded staff
// actions (assign, share the current cut, publish) are a small client child that
// posts to POST /api/review.
export async function ReviewPanel({ id, req }: UIFieldServerProps) {
	if (!isStaff(req.user) || id === undefined) return null
	const videoId = Number(id)
	let history: Awaited<ReturnType<typeof reviewHistory>> = null
	let row: ReviewQueueRow | null = null
	let failed = false
	try {
		const store = new ReviewStore(cloudflare.env.D1)
		;[history, row] = await Promise.all([reviewHistory(store, videoId), reviewQueueRow(store, videoId)])
	} catch (error) {
		failed = true
		console.error(JSON.stringify({ level: 'error', message: 'review history failed', error: String(error) }))
	}
	const audit = (slug: string) => `${collectionPath(slug)}?where[video][equals]=${videoId}`
	if (failed) return <p className="academy-widget__error">Review history is unavailable right now.</p>
	if (!history) {
		return (
			<div className="academy-panel">
				<h3 className="academy-panel__title">Not in client review</h3>
				<p className="academy-panel__text">
					This video has no client review. Start one from{' '}
					<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
						Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
					</a>
					.
				</p>
			</div>
		)
	}
	const current = history.revisions.find(revision => revision.id === history.currentRevisionId)
	const staff = await staffDirectory(req.payload)
	const available = row?.status === 'ready-to-publish' ? await publicationAvailable(videoId) : false
	return (
		<div className="academy-panel">
			<div className="academy-panel__summary">
				{row ? <QueueStatusPill status={row.status} /> : <ReviewStatePill state={current?.state ?? null} />}
				<span>{current ? `Revision v${current.reviewVersion}, cut ${timeAgo(current.createdAt)}` : 'No cut uploaded yet'}</span>
				<span>{plural(history.openComments, 'open comment')}</span>
				<span>{plural(history.activeReviewers, 'reviewer')}</span>
			</div>
			{row ? (
				<ReviewActions
					row={{
						videoId,
						title: row.videoTitle || `Video ${videoId}`,
						status: row.status,
						revisionId: row.revisionId,
						reviewVersion: row.reviewVersion,
						decisionId: row.decisionId,
						assignee: row.assignee,
						assignmentVersion: row.assignmentVersion,
						publicationAvailable: available,
					}}
					staff={staff}
				/>
			) : null}
			<div className="academy-panel__actions">
				<Link href={reviewQueuePath} prefetch={false}>
					Review queue
				</Link>
				<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
					Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
				</a>
			</div>
			{history.revisions.length ? (
				<table className="academy-table academy-table--compact">
					<caption>Revisions, newest first</caption>
					<thead>
						<tr>
							<th scope="col">Cut</th>
							<th scope="col">Title</th>
							<th scope="col">State</th>
							<th scope="col">Uploaded</th>
						</tr>
					</thead>
					<tbody>
						{history.revisions.map(revision => (
							<tr key={revision.id}>
								<td>v{revision.reviewVersion}</td>
								<td>{revision.title ?? <span className="academy-muted">Untitled</span>}</td>
								<td>
									<ReviewStatePill state={revision.state} />
								</td>
								<td>{timeAgo(revision.createdAt)}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
			{history.decisions.length ? (
				<ul className="academy-list">
					{history.decisions.map(decision => (
						<li key={decision.id} className="academy-list__row">
							<span className="academy-list__title">{decision.decision === 'approved' ? 'Approved' : 'Changes requested'}</span>
							<span className="academy-list__meta">{timeAgo(decision.createdAt)}</span>
							{decision.note ? <span className="academy-list__note">{decision.note}</span> : null}
						</li>
					))}
				</ul>
			) : null}
			<p className="academy-panel__footnote">
				Audit records: <Link href={audit('video-revisions')}>revisions</Link>, <Link href={audit('review-comments')}>comments</Link>,{' '}
				<Link href={audit('review-decisions')}>decisions</Link>.
			</p>
		</div>
	)
}
