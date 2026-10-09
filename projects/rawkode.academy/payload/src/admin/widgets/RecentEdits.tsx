import { Link } from '@payloadcms/ui'
import type { CollectionSlug, WidgetServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { timeAgo } from '../format'
import { documentPath } from '../links'
import { StatusPill } from '../views/ReviewStatePill'

const watched = ['videos', 'articles', 'news', 'courses', 'people', 'technologies'] as const
const kinds: Record<(typeof watched)[number], string> = {
	videos: 'Video',
	articles: 'Article',
	news: 'News',
	courses: 'Course',
	people: 'Person',
	technologies: 'Technology',
}
type Edit = { slug: string; kind: string; id: string | number; title: string; status: unknown; updatedAt: string }

export async function RecentEditsWidget({ req, user }: WidgetServerProps) {
	if (!isStaff(user)) return null
	const results = await Promise.allSettled(
		watched.map(slug =>
			req.payload.find({
				collection: slug as CollectionSlug,
				sort: '-updatedAt',
				limit: 5,
				depth: 0,
				draft: true,
				overrideAccess: false,
				user: req.user,
				req,
				select: { title: true, name: true, _status: true, updatedAt: true } as never,
			}),
		),
	)
	const edits: Edit[] = results.flatMap((result, index) => {
		if (result.status !== 'fulfilled') return []
		return result.value.docs.map(doc => {
			const record = doc as Record<string, unknown>
			return {
				slug: watched[index] as string,
				kind: kinds[watched[index]],
				id: record.id as string | number,
				title: String(record.title || record.name || `Untitled ${record.id}`),
				status: record._status,
				updatedAt: String(record.updatedAt ?? ''),
			}
		})
	})
	edits.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
	const failed = results.some(result => result.status === 'rejected')
	return (
		<section className="academy-widget" aria-label="Recent edits">
			<header className="academy-widget__header">
				<h2 className="academy-widget__title">Recent edits</h2>
			</header>
			{failed ? <p className="academy-widget__error">Some collections could not be read.</p> : null}
			{edits.length ? (
				<ol className="academy-list">
					{edits.slice(0, 8).map(edit => (
						<li key={`${edit.slug}:${edit.id}`} className="academy-list__row">
							<Link className="academy-list__title" href={documentPath(edit.slug, edit.id)} prefetch={false}>
								{edit.title}
							</Link>
							<span className="academy-list__kind">{edit.kind}</span>
							<StatusPill status={edit.status} />
							<span className="academy-list__meta">{timeAgo(edit.updatedAt)}</span>
						</li>
					))}
				</ol>
			) : (
				<p className="academy-widget__empty">No edits yet.</p>
			)}
		</section>
	)
}
