import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, Link } from '@payloadcms/ui'
import { notFound } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { queueStatusLabels, type QueueStatus } from '../../review/queue'
import { ReviewActions } from '../fields/ReviewActions'
import { formatTime, plural, timeAgo } from '../format'
import { collectionPath, documentPath, previewReviewUrl } from '../links'
import { publicationAvailable, reviewSnapshot, staffDirectory } from '../review-data'
import { BroadcastCalendar } from './BroadcastCalendar'
import { QueueStatusPill } from './ReviewStatePill'

const summary: QueueStatus[] = ['ready-to-publish', 'changes-requested', 'approval-invalidated', 'approved-open-comments', 'needs-share', 'no-revision', 'processing', 'awaiting-client', 'published']

// /admin/review. Lists every video in the review flow with its derived status,
// and carries the guarded staff actions (assign, share a cut with a client,
// publish an approved cut). Each action posts to POST /api/review, which
// re-checks every guard; nothing here writes directly. Below the queue, the
// broadcast calendar lists scheduled and running live videos.
export async function ReviewQueueView({ initPageResult, params, searchParams }: AdminViewServerProps) {
	const { req, permissions, locale, visibleEntities } = initPageResult
	if (!isStaff(req.user)) notFound()
	const [snapshot, staff] = await Promise.all([reviewSnapshot(200), staffDirectory(req.payload)])
	const available = new Map(
		await Promise.all(snapshot.rows.filter(row => row.status === 'ready-to-publish').map(async row => [row.videoId, await publicationAvailable(row.videoId)] as const)),
	)
	const audit = (slug: string, videoId: number) => `${collectionPath(slug)}?where[video][equals]=${videoId}`
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
						Every video in client review, with the next step first. Assign an owner, share the current cut with a client, and publish once it is approved.
						Clients review in{' '}
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
				<ul className="academy-stats" aria-label="Videos in review by status">
					{summary.map(status => (
						<li key={status} className={`academy-stat academy-stat--${status}`}>
							<span className="academy-stat__value">{snapshot.counts[status]}</span>
							<span className="academy-stat__label">{queueStatusLabels[status]}</span>
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
									<th scope="col">Status</th>
									<th scope="col">Actions</th>
									<th scope="col">Cut</th>
									<th scope="col">Open comments</th>
									<th scope="col">Reviewers</th>
									<th scope="col">First published</th>
									<th scope="col">Audit</th>
								</tr>
							</thead>
							<tbody>
								{snapshot.rows.map(row => {
									const title = row.videoTitle || `Video ${row.videoId}`
									return (
										<tr key={row.videoId}>
											<th scope="row">
												<Link href={documentPath('videos', row.videoId)} prefetch={false}>
													{title}
												</Link>
												{row.revisionTitle ? <span className="academy-table__sub">{row.revisionTitle}</span> : null}
											</th>
											<td>
												<QueueStatusPill status={row.status} />
												{row.latestDecisionAt ? <span className="academy-table__when">Decision {timeAgo(row.latestDecisionAt)}</span> : null}
											</td>
											<td>
												<ReviewActions
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
											</td>
											<td>
												{row.reviewVersion ? `v${row.reviewVersion}` : <span className="academy-muted">None</span>}
												{row.createdAt ? <span className="academy-table__when">{timeAgo(row.createdAt)}</span> : null}
											</td>
											<td>{row.openComments ? <strong>{row.openComments}</strong> : <span className="academy-muted">0</span>}</td>
											<td>
												{row.activeReviewers ? plural(row.activeReviewers, 'reviewer') : <span className="academy-muted">None</span>}
												{row.revisionId ? <span className="academy-table__sub">{plural(row.approverCount, 'approver')} on this cut</span> : null}
											</td>
											<td>{row.times.publishedAt ? formatTime(row.times.publishedAt, 'UTC') : <span className="academy-muted">Not yet</span>}</td>
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
									)
								})}
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
				<BroadcastCalendar rows={snapshot.broadcasts} />
			</Gutter>
		</DefaultTemplate>
	)
}
