import { Link } from '@payloadcms/ui'
import type { WidgetServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { queueStatusLabels, staffActionStatuses, type QueueStatus } from '../../review/queue'
import { ReviewActions } from '../fields/ReviewActions'
import { timeAgo } from '../format'
import { documentPath, previewReviewUrl, reviewQueuePath } from '../links'
import { publicationAvailable, reviewSnapshot, staffDirectory } from '../review-data'
import { QueueStatusPill } from '../views/ReviewStatePill'

// Summary of the queue, with compact guarded actions on the rows waiting on
// staff. Actions post to POST /api/review only; the full list is the queue view.
export async function ReviewQueueWidget({ req, user }: WidgetServerProps) {
	if (!isStaff(user)) return null
	const [snapshot, staff] = await Promise.all([reviewSnapshot(), staffDirectory(req.payload)])
	const waiting = snapshot.rows.filter(row => staffActionStatuses.includes(row.status)).slice(0, 5)
	const available = new Map(
		await Promise.all(waiting.filter(row => row.status === 'ready-to-publish').map(async row => [row.videoId, await publicationAvailable(row.videoId)] as const)),
	)
	// Every staff-action status gets a tile, so the tiles add up to the nav badge.
	const order: QueueStatus[] = ['ready-to-publish', 'changes-requested', 'approval-invalidated', 'approved-open-comments', 'needs-share', 'no-revision', 'awaiting-client', 'published']
	return (
		<section className="academy-widget" aria-label="Review queue">
			<header className="academy-widget__header">
				<h2 className="academy-widget__title">Review queue</h2>
				<div className="academy-widget__actions">
					<Link href={reviewQueuePath} prefetch={false}>
						Open queue
					</Link>
					<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
						Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
					</a>
				</div>
			</header>
			{snapshot.error ? <p className="academy-widget__error">{snapshot.error}</p> : null}
			<ul className="academy-stats" aria-label="Videos in review by status">
				{order.map(status => (
					<li key={status} className={`academy-stat academy-stat--${status}`}>
						<span className="academy-stat__value">{snapshot.counts[status]}</span>
						<span className="academy-stat__label">{queueStatusLabels[status]}</span>
					</li>
				))}
			</ul>
			{waiting.length ? (
				<ol className="academy-list">
					{waiting.map(row => {
						const title = row.videoTitle || `Video ${row.videoId}`
						return (
							<li key={row.videoId} className="academy-list__row">
								<Link className="academy-list__title" href={documentPath('videos', row.videoId)} prefetch={false}>
									{title}
								</Link>
								<QueueStatusPill status={row.status} />
								<span className="academy-list__meta">
									{row.createdAt
										? [row.reviewVersion ? `v${row.reviewVersion}` : null, `cut ${timeAgo(row.createdAt)}`].filter(Boolean).join(' · ')
										: 'no cut yet'}
								</span>
								<ReviewActions
									compact
									row={{
										videoId: row.videoId,
										title,
										status: row.status,
										revisionId: row.revisionId,
										reviewVersion: row.reviewVersion,
										decisionId: row.decisionId,
										assignee: row.assignee,
										assignmentVersion: row.assignmentVersion,
										publicationAvailable: available.get(row.videoId) ?? false,
									}}
									staff={staff}
								/>
							</li>
						)
					})}
				</ol>
			) : (
				<p className="academy-widget__empty">Nothing is waiting on staff. Client reviews in progress are listed in the queue.</p>
			)}
		</section>
	)
}
