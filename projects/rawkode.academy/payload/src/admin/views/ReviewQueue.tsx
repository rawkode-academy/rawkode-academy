import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, Link } from '@payloadcms/ui'
import { notFound } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { reviewStateLabels } from '../../review/queue'
import { plural, timeAgo } from '../format'
import { collectionPath, documentPath, previewReviewUrl } from '../links'
import { reviewSnapshot } from '../review-data'
import { ReviewStatePill } from './ReviewStatePill'

// /admin/review. Read-only: it lists existing review state and links to the
// video, its audit records and the client Preview review UI. It issues no
// commands and writes no grants.
// Extension points:
// - Workstream D: per-row reviewer grants (read and issue through D's API).
// - Workstream F: guarded Share and Publish actions with a confirm dialog that
//   call F's staff commands.
export async function ReviewQueueView({ initPageResult, params, searchParams }: AdminViewServerProps) {
	const { req, permissions, locale, visibleEntities } = initPageResult
	if (!isStaff(req.user)) notFound()
	const snapshot = await reviewSnapshot(200)
	const audit = (slug: string, videoId: string) => `${collectionPath(slug)}?where[video][equals]=${encodeURIComponent(videoId)}`
	return (
		<DefaultTemplate
			i18n={req.i18n}
			locale={locale}
			params={params}
			payload={req.payload}
			permissions={permissions}
			searchParams={searchParams}
			user={req.user ?? undefined}
			visibleEntities={visibleEntities}
		>
			<Gutter className="academy-view">
				<header className="academy-view__header">
					<h1 className="academy-view__title">Review queue</h1>
					<p className="academy-view__lede">
						Client review status for every video in the review flow, oldest cut first. Change review state in{' '}
						<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
							Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
						</a>
						.
					</p>
				</header>
				{snapshot.error ? (
					<p className="academy-widget__error" role="alert">
						{snapshot.error}
					</p>
				) : null}
				<ul className="academy-stats" aria-label="Videos in review by state">
					{(['changes-requested', 'approved', 'no-revision', 'ready', 'published'] as const).map(state => (
						<li key={state} className={`academy-stat academy-stat--${state}`}>
							<span className="academy-stat__value">{snapshot.counts[state]}</span>
							<span className="academy-stat__label">{reviewStateLabels[state]}</span>
						</li>
					))}
				</ul>
				{snapshot.rows.length ? (
					<div className="academy-table__scroll">
						<table className="academy-table">
							<caption className="academy-visually-hidden">Videos in client review</caption>
							<thead>
								<tr>
									<th scope="col">Video</th>
									<th scope="col">State</th>
									<th scope="col">Revision</th>
									<th scope="col">Cut</th>
									<th scope="col">Open comments</th>
									<th scope="col">Reviewers</th>
									<th scope="col">Latest decision</th>
									<th scope="col">Audit</th>
								</tr>
							</thead>
							<tbody>
								{snapshot.rows.map(row => (
									<tr key={row.videoId}>
										<th scope="row">
											<Link href={documentPath('videos', row.videoId)} prefetch={false}>
												{row.videoTitle || `Video ${row.videoId}`}
											</Link>
											{row.revisionTitle ? <span className="academy-table__sub">{row.revisionTitle}</span> : null}
										</th>
										<td>
											<ReviewStatePill state={row.state} />
										</td>
										<td>{row.reviewVersion ? `v${row.reviewVersion}` : <span className="academy-muted">None</span>}</td>
										<td>{row.createdAt ? timeAgo(row.createdAt) : <span className="academy-muted">None</span>}</td>
										<td>{row.openComments ? <strong>{row.openComments}</strong> : <span className="academy-muted">0</span>}</td>
										<td>{row.activeReviewers ? plural(row.activeReviewers, 'reviewer') : <span className="academy-muted">None</span>}</td>
										<td>
											{row.latestDecision ? (
												<>
													{row.latestDecision === 'approved' ? 'Approved' : 'Changes requested'}
													{row.latestDecisionAt ? <span className="academy-table__when">{timeAgo(row.latestDecisionAt)}</span> : null}
												</>
											) : (
												<span className="academy-muted">None</span>
											)}
										</td>
										<td>
											<div className="academy-table__links">
												<Link href={audit('video-revisions', row.videoId)} prefetch={false}>
													Revisions
												</Link>
												<Link href={audit('review-comments', row.videoId)} prefetch={false}>
													Comments
												</Link>
												<Link href={audit('review-decisions', row.videoId)} prefetch={false}>
													Decisions
												</Link>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="academy-empty">
						<h2>No videos are in review</h2>
						<p>
							Start a client review from{' '}
							<a href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
								Preview review<span className="academy-visually-hidden"> (opens in a new tab)</span>
							</a>
							. Videos appear here once their first review exists.
						</p>
					</div>
				)}
			</Gutter>
		</DefaultTemplate>
	)
}
