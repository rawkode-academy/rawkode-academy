import { Link } from '@payloadcms/ui'
import type { UIFieldServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { cloudflare } from '../../cloudflare'
import { reviewHistory } from '../../review/queue'
import { ReviewStore } from '../../review/store'
import { plural, timeAgo } from '../format'
import { collectionPath, previewReviewUrl, reviewQueuePath } from '../links'
import { ReviewStatePill } from '../views/ReviewStatePill'

// Server-rendered Review tab for a video. Read-only, and deliberately not join
// fields: no extra subqueries on public reads and no grant data in form state.
// Extension points: workstream D's share link and F's publish-approved action
// mount below the history as a small client child.
export async function ReviewPanel({ id, req }: UIFieldServerProps) {
	if (!isStaff(req.user) || id === undefined) return null
	const videoId = String(id)
	let history: Awaited<ReturnType<typeof reviewHistory>> = null
	let failed = false
	try {
		history = await reviewHistory(new ReviewStore(cloudflare.env.D1), videoId)
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
	return (
		<div className="academy-panel">
			<div className="academy-panel__summary">
				<ReviewStatePill state={current?.state ?? null} />
				<span>{current ? `Revision v${current.reviewVersion}, cut ${timeAgo(current.createdAt)}` : 'No cut uploaded yet'}</span>
				<span>{plural(history.openComments, 'open comment')}</span>
				<span>{plural(history.activeReviewers, 'reviewer')}</span>
			</div>
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
