import { Link } from '@payloadcms/ui'
import type { WidgetServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { queueState, reviewStateLabels, staffActionStates } from '../../review/queue'
import { timeAgo } from '../format'
import { documentPath, previewReviewUrl, reviewQueuePath } from '../links'
import { reviewSnapshot } from '../review-data'
import { ReviewStatePill } from '../views/ReviewStatePill'

// Read-only summary. Extension point: when workstream F lands its guarded
// share/publish commands, row actions go here, posting to those commands only.
export async function ReviewQueueWidget({ user }: WidgetServerProps) {
	if (!isStaff(user)) return null
	const snapshot = await reviewSnapshot()
	const waiting = snapshot.rows.filter(row => staffActionStates.includes(queueState(row.state))).slice(0, 5)
	const order = ['changes-requested', 'approved', 'no-revision', 'ready', 'published'] as const
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
			<ul className="academy-stats" aria-label="Videos in review by state">
				{order.map(state => (
					<li key={state} className={`academy-stat academy-stat--${state}`}>
						<span className="academy-stat__value">{snapshot.counts[state]}</span>
						<span className="academy-stat__label">{reviewStateLabels[state]}</span>
					</li>
				))}
			</ul>
			{waiting.length ? (
				<ol className="academy-list">
					{waiting.map(row => (
						<li key={row.videoId} className="academy-list__row">
							<Link className="academy-list__title" href={documentPath('videos', row.videoId)} prefetch={false}>
								{row.videoTitle || `Video ${row.videoId}`}
							</Link>
							<ReviewStatePill state={row.state} />
							<span className="academy-list__meta">
								{row.createdAt
									? [row.reviewVersion ? `v${row.reviewVersion}` : null, `cut ${timeAgo(row.createdAt)}`].filter(Boolean).join(' · ')
									: 'no cut yet'}
							</span>
							{row.revisionTitle ? <span className="academy-list__note">{row.revisionTitle}</span> : null}
						</li>
					))}
				</ol>
			) : (
				<p className="academy-widget__empty">Nothing is waiting on staff. Client reviews in progress are listed in the queue.</p>
			)}
		</section>
	)
}
