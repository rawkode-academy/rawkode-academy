import { Link } from '@payloadcms/ui'
import type { WidgetServerProps } from 'payload'
import { isStaff } from '../../auth/access'
import { cloudflare } from '../../cloudflare'
import { adminAccessOf, isDeveloper } from '../access'
import { adminPresets } from '../collection-admin'
import { collectionPath } from '../links'

// Import health from existing provenance columns. One read-only D1 query; no
// new tables. Copy and visibility will follow workstream G's cutover.
const tracked = ['videos', 'shows', 'episodes', 'people', 'technologies', 'articles', 'courses', 'news'] as const
type Row = { slug: string; pending: number; diverged: number; tombstoned: number }

const where = (field: string, value: string) => `where[${field}][equals]=${value}`

export async function ImportHealthWidget({ req, user }: WidgetServerProps) {
	if (!isStaff(user)) return null
	return <ImportHealthBody developer={isDeveloper(adminAccessOf(req.payload), user)} />
}

async function readHealth(): Promise<{ rows: Row[]; markers: number } | null> {
	try {
		// One statement per table in a single D1 batch (D1 caps compound SELECT terms).
		const db = cloudflare.env.D1 as D1Database
		const statements = tracked.map(slug =>
			db.prepare(
				`SELECT '${slug}' AS slug,
					COALESCE(SUM(CASE WHEN import_state='pending' THEN 1 ELSE 0 END),0) AS pending,
					COALESCE(SUM(CASE WHEN locally_edited=1 AND source_hash IS NOT NULL THEN 1 ELSE 0 END),0) AS diverged,
					COALESCE(SUM(CASE WHEN tombstone=1 THEN 1 ELSE 0 END),0) AS tombstoned
				FROM ${slug.replaceAll('-', '_')}`,
			),
		)
		const results = await db.batch<Row | { total: number }>([...statements, db.prepare('SELECT COUNT(*) AS total FROM deletion_markers')])
		const rows = results.slice(0, -1).map(result => result.results[0] as Row)
		const markers = (results.at(-1)?.results[0] as { total: number } | undefined)?.total
		return {
			rows: rows.map(row => ({ ...row, pending: Number(row.pending), diverged: Number(row.diverged), tombstoned: Number(row.tombstoned) })),
			markers: Number(markers ?? 0),
		}
	} catch (error) {
		console.error(JSON.stringify({ level: 'error', message: 'import health failed', error: String(error) }))
		return null
	}
}

async function ImportHealthBody({ developer }: { developer: boolean }) {
	const health = await readHealth()
	const rows = health?.rows.filter(row => row.pending || row.diverged || row.tombstoned) ?? []
	const total = (key: keyof Omit<Row, 'slug'>) => rows.reduce((sum, row) => sum + row[key], 0)
	return (
		<section className="academy-widget" aria-label="Import health">
			<header className="academy-widget__header">
				<h2 className="academy-widget__title">Import health</h2>
			</header>
			{!health ? <p className="academy-widget__error">Import health is unavailable right now.</p> : null}
			{health ? (
				<ul className="academy-stats academy-stats--compact">
					<li className="academy-stat academy-stat--warning">
						<span className="academy-stat__value">{total('pending')}</span>
						<span className="academy-stat__label">Import pending</span>
					</li>
					<li className="academy-stat">
						<span className="academy-stat__value">{total('diverged')}</span>
						<span className="academy-stat__label">Edited since import</span>
					</li>
					<li className="academy-stat">
						<span className="academy-stat__value">{total('tombstoned')}</span>
						<span className="academy-stat__label">Tombstoned</span>
					</li>
				</ul>
			) : null}
			{rows.length ? (
				<table className="academy-table academy-table--compact">
					<caption className="academy-visually-hidden">Import state by collection</caption>
					<thead>
						<tr>
							<th scope="col">Collection</th>
							<th scope="col">Pending</th>
							<th scope="col">Edited</th>
							<th scope="col">Tombstoned</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(row => {
							const label = adminPresets[row.slug]?.labels?.plural ?? row.slug.replace(/^./, letter => letter.toUpperCase())
							const cell = (value: number, query: string) =>
								value ? (
									<Link href={`${collectionPath(row.slug)}?${query}`} prefetch={false}>
										{value}
									</Link>
								) : (
									<span className="academy-muted">0</span>
								)
							return (
								<tr key={row.slug}>
									<th scope="row">{label}</th>
									<td>{cell(row.pending, where('importState', 'pending'))}</td>
									<td>{cell(row.diverged, where('locallyEdited', 'true'))}</td>
									<td>{cell(row.tombstoned, where('tombstone', 'true'))}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			) : health ? (
				<p className="academy-widget__empty">Everything imported cleanly.</p>
			) : null}
			{developer && health ? (
				<p className="academy-widget__footnote">
					<Link href={collectionPath('deletion-markers')} prefetch={false}>
						{health.markers} deletion markers
					</Link>{' '}
					stop re-import from restoring deleted records.
				</p>
			) : null}
		</section>
	)
}
