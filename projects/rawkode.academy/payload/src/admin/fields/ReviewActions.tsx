'use client'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { CommandIds, errorText, getJson, postCommand, type CommandResult } from './commands'

// Guarded staff actions for one video in review: assign, share the current cut
// with a client (workstream D's share command) and publish an approved cut. Every
// action posts to the existing POST /api/review command endpoint; the server
// re-checks every guard. Rendered by the Review queue view, the dashboard widget
// and the video Review tab. No <form>: the Review tab sits inside Payload's form.
export type ReviewActionRow = {
	videoId: number
	title: string
	status: string
	revisionId: string | null
	reviewVersion: number | null
	decisionId: string | null
	assignee: { id: number; name: string } | null
	assignmentVersion: number
	publicationAvailable: boolean
}
type Customer = { userId: number; name: string; profileEmail: string }

export function ReviewActions({ row, staff, compact = false }: { row: ReviewActionRow; staff: { id: number; name: string }[]; compact?: boolean }) {
	const router = useRouter()
	const ids = useRef(new CommandIds())
	const base = useId()
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
	const [sharing, setSharing] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [search, setSearch] = useState('')
	const [customers, setCustomers] = useState<Customer[] | null>(null)
	const [customer, setCustomer] = useState('')
	const [canApprove, setCanApprove] = useState(true)
	const [days, setDays] = useState(30)

	async function run(intent: Record<string, unknown>, done: string) {
		setBusy(true)
		setMessage(null)
		const result: CommandResult = await postCommand('/api/review', { ...intent, videoId: row.videoId, commandId: ids.current.for(intent) })
		ids.current.settle(intent, result)
		setBusy(false)
		if (result.ok) {
			setMessage({ tone: 'ok', text: done })
			setSharing(false)
			setConfirming(false)
			router.refresh()
			return
		}
		setMessage({ tone: 'error', text: errorText(result) })
		if (result.status === 409) router.refresh()
	}

	async function findCustomers() {
		setMessage(null)
		try {
			const data = await getJson<{ reviewers: Customer[] }>(`/api/review/reviewers?q=${encodeURIComponent(search.trim())}`)
			setCustomers(data.reviewers)
			setCustomer(data.reviewers[0] ? String(data.reviewers[0].userId) : '')
		} catch (error) {
			setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Customer search failed' })
		}
	}

	const canPublish = row.status === 'ready-to-publish' && row.publicationAvailable && Boolean(row.revisionId && row.reviewVersion && row.decisionId)
	return (
		<div className={`academy-actions${compact ? ' academy-actions--compact' : ''}`} aria-busy={busy}>
			<label className="academy-actions__field" htmlFor={`${base}-assignee`}>
				<span className={compact ? 'academy-visually-hidden' : 'academy-actions__label'}>Assignee</span>
				<select
					id={`${base}-assignee`}
					value={row.assignee ? String(row.assignee.id) : ''}
					disabled={busy}
					onChange={event => run({ action: 'assign', assigneeId: event.target.value ? Number(event.target.value) : null, expectedAssignmentVersion: row.assignmentVersion }, 'Assignment saved.')}
				>
					<option value="">Unassigned</option>
					{row.assignee && !staff.some(person => person.id === row.assignee!.id) ? <option value={row.assignee.id}>{row.assignee.name}</option> : null}
					{staff.map(person => (
						<option key={person.id} value={person.id}>
							{person.name}
						</option>
					))}
				</select>
			</label>
			{row.revisionId && row.status !== 'published' ? (
				<button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} aria-expanded={sharing} onClick={() => setSharing(open => !open)}>
					Share
				</button>
			) : null}
			{row.status === 'ready-to-publish' ? (
				confirming ? (
					<span className="academy-actions__confirm" role="group" aria-label={`Confirm publishing ${row.title}`}>
						<span>Publish this cut publicly?</span>
						<button
							type="button"
							className="btn btn--style-primary btn--size-small"
							disabled={busy}
							onClick={() => run({ action: 'publish', revisionId: row.revisionId, expectedReviewVersion: row.reviewVersion, decisionId: row.decisionId }, 'Published.')}
						>
							Confirm publish
						</button>
						<button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => setConfirming(false)}>
							Cancel
						</button>
					</span>
				) : (
					<button
						type="button"
						className="btn btn--style-primary btn--size-small"
						disabled={busy || !canPublish}
						title={canPublish ? undefined : 'The approved deliverable is not available for publication yet'}
						onClick={() => setConfirming(true)}
					>
						Publish
					</button>
				)
			) : null}
			{sharing ? (
				<div className="academy-actions__share" role="group" aria-label={`Share ${row.title} with a client`}>
					<label className="academy-actions__field" htmlFor={`${base}-search`}>
						<span className="academy-actions__label">Find a client</span>
						<input
							id={`${base}-search`}
							type="search"
							value={search}
							maxLength={120}
							placeholder="Name or email"
							onChange={event => setSearch(event.target.value)}
							onKeyDown={event => {
								if (event.key === 'Enter') {
									event.preventDefault()
									void findCustomers()
								}
							}}
						/>
					</label>
					<button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => void findCustomers()}>
						Search
					</button>
					{customers ? (
						customers.length ? (
							<>
								<label className="academy-actions__field" htmlFor={`${base}-customer`}>
									<span className="academy-actions__label">Client</span>
									<select id={`${base}-customer`} value={customer} onChange={event => setCustomer(event.target.value)}>
										{customers.map(person => (
											<option key={person.userId} value={person.userId}>
												{person.profileEmail ? `${person.name} (${person.profileEmail})` : person.name}
											</option>
										))}
									</select>
								</label>
								<label className="academy-actions__check" htmlFor={`${base}-approve`}>
									<input id={`${base}-approve`} type="checkbox" checked={canApprove} onChange={event => setCanApprove(event.target.checked)} />
									Can approve
								</label>
								<label className="academy-actions__field" htmlFor={`${base}-days`}>
									<span className="academy-actions__label">Access for (days)</span>
									<input id={`${base}-days`} type="number" min={1} max={90} value={days} onChange={event => setDays(Math.max(1, Math.min(90, Number(event.target.value) || 30)))} />
								</label>
								<button
									type="button"
									className="btn btn--style-primary btn--size-small"
									disabled={busy || !customer}
									onClick={() => run({ action: 'share', revisionId: row.revisionId, userId: Number(customer), canApprove, expiresInDays: days }, 'Shared with the client.')}
								>
									Share this cut
								</button>
							</>
						) : (
							<span className="academy-muted">No customer accounts match. A client must sign in once before you can share.</span>
						)
					) : null}
				</div>
			) : null}
			{message ? (
				<p className={message.tone === 'error' ? 'academy-actions__error' : 'academy-actions__ok'} role={message.tone === 'error' ? 'alert' : 'status'}>
					{message.text}
				</p>
			) : null}
		</div>
	)
}
