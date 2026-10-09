import { Link } from '@payloadcms/ui'
import { liveStaleMs } from '../../published/contract'
import type { BroadcastRow } from '../../review/queue'
import { formatTime } from '../format'
import { documentPath } from '../links'

// Scheduled and running live videos, with or without client review. Times are
// changed in each video's Times tab (guarded editorial commands); Rawkode Studio
// records the broadcast start and end itself.
function state(row: BroadcastRow, now: number) {
	if (row.times.broadcastStartedAt) {
		return now - Date.parse(row.times.broadcastStartedAt) <= liveStaleMs
			? { key: 'live', label: 'Live now' }
			: { key: 'stale', label: 'No end recorded' }
	}
	// Past its start with nothing reported: a missed stream or a lost Studio event.
	if (row.times.scheduledStartAt && Date.parse(row.times.scheduledStartAt) < now) return { key: 'overdue', label: 'Not started' }
	return { key: 'scheduled', label: 'Scheduled' }
}

export function BroadcastCalendar({ rows, now = Date.now() }: { rows: BroadcastRow[]; now?: number }) {
	return (
		<section className="academy-calendar" aria-labelledby="academy-broadcasts">
			<h2 id="academy-broadcasts" className="academy-panel__title">
				Broadcast calendar
			</h2>
			{rows.length ? (
				<div className="academy-table__scroll">
					<table className="academy-table">
						<caption className="academy-visually-hidden">Scheduled and running live videos</caption>
						<thead>
							<tr>
								<th scope="col">Video</th>
								<th scope="col">State</th>
								<th scope="col">Scheduled start (UTC)</th>
								<th scope="col">Broadcast started (UTC)</th>
							</tr>
						</thead>
						<tbody>
							{rows.map(row => {
								const current = state(row, now)
								return (
									<tr key={row.videoId}>
										<th scope="row">
											<Link href={documentPath('videos', row.videoId)} prefetch={false}>
												{row.title || row.legacyId}
											</Link>
										</th>
										<td>
											<span className={`academy-pill academy-pill--broadcast-${current.key}`}>{current.label}</span>
										</td>
										<td>{row.times.scheduledStartAt ? formatTime(row.times.scheduledStartAt, 'UTC') : <span className="academy-muted">Not scheduled</span>}</td>
										<td>{row.times.broadcastStartedAt ? formatTime(row.times.broadcastStartedAt, 'UTC') : <span className="academy-muted">Not yet</span>}</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			) : (
				<p className="academy-panel__text">No live videos are scheduled. Schedule one from a live video's Times tab.</p>
			)}
		</section>
	)
}
