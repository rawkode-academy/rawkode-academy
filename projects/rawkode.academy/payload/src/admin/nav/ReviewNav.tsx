import { Link, NavGroup } from '@payloadcms/ui'
import { isStaff } from '../../auth/access'
import { previewReviewUrl, reviewQueuePath } from '../links'
import { reviewSnapshot } from '../review-data'

// A task-named group at the top of the nav. Payload cannot inject links into
// a collection group, so the review audit tables are group:false and reached
// from here instead.
export async function ReviewNav({ user }: { user?: unknown }) {
	if (!isStaff(user)) return null
	const snapshot = await reviewSnapshot()
	const waiting = snapshot.needsStaff
	return (
		<NavGroup label="Review">
			<Link className="nav__link academy-nav__link" href={reviewQueuePath} prefetch={false}>
				<span className="nav__link-label">Review queue</span>
				{waiting > 0 ? (
					<span className="academy-count" title={`${waiting} waiting on staff`}>
						{waiting}
						<span className="academy-visually-hidden"> waiting on staff</span>
					</span>
				) : null}
			</Link>
			<a className="nav__link academy-nav__link" href={previewReviewUrl} target="_blank" rel="noopener noreferrer">
				<span className="nav__link-label">Preview review</span>
				<span className="academy-external" aria-hidden="true">
					↗
				</span>
				<span className="academy-visually-hidden"> (opens in a new tab)</span>
			</a>
		</NavGroup>
	)
}
