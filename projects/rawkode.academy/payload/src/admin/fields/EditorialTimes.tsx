'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { formatTime } from '../format'
import { CommandIds, errorText, fromLocalInput, getJson, postCommand, toLocalInput } from './commands'

// Broadcast and publication times for one video. They live outside the video
// document (src/editorial), so this panel reads and writes them through the
// guarded staff commands at /api/editorial/times and works for videos frozen by
// client review too. No <form>: the panel sits inside Payload's document form.
type Times = { scheduledStartAt: string | null; broadcastStartedAt: string | null; broadcastEndedAt: string | null; publishedAt: string | null }
type Read = {
	videoId: number
	type: string | null
	stored: Times | null
	effective: Times
	version: number
	source: string | null
	history: { id: string; action: string; actor: string; field: string; previous: string | null; next: string | null; note: string; createdAt: string }[]
}
const labels: Record<keyof Times, string> = {
	scheduledStartAt: 'Scheduled start',
	broadcastStartedAt: 'Broadcast started',
	broadcastEndedAt: 'Broadcast ended',
	publishedAt: 'First published',
}
const correctable = ['scheduledStartAt', 'broadcastStartedAt', 'broadcastEndedAt'] as const
const sources: Record<string, string> = { backfill: 'migration backfill', editorial: 'staff', studio: 'Rawkode Studio', review: 'review publish' }

export function EditorialTimesField() {
	const { id } = useDocumentInfo()
	const base = useId()
	const ids = useRef(new CommandIds())
	const [data, setData] = useState<Read | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
	const [busy, setBusy] = useState(false)
	const [schedule, setSchedule] = useState('')
	const [correcting, setCorrecting] = useState(false)
	const [fields, setFields] = useState<Record<(typeof correctable)[number], string>>({ scheduledStartAt: '', broadcastStartedAt: '', broadcastEndedAt: '' })
	const [note, setNote] = useState('')

	const load = useCallback(async () => {
		if (id === undefined || id === null) return
		try {
			const next = await getJson<Read>(`/api/editorial/times?videoId=${encodeURIComponent(String(id))}`)
			setData(next)
			setError(null)
			setSchedule(toLocalInput(next.stored?.scheduledStartAt ?? next.effective.scheduledStartAt))
			setFields({
				scheduledStartAt: toLocalInput(next.effective.scheduledStartAt),
				broadcastStartedAt: toLocalInput(next.effective.broadcastStartedAt),
				broadcastEndedAt: toLocalInput(next.effective.broadcastEndedAt),
			})
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Times are unavailable right now.')
		}
	}, [id])

	useEffect(() => {
		void load()
	}, [load])

	if (id === undefined || id === null) return <p className="academy-panel__text">Save the video first.</p>
	if (error) return <p className="academy-widget__error">{error}</p>
	if (!data) return <p className="academy-panel__text">Loading times…</p>

	async function submit(intent: Record<string, unknown>, done: string) {
		if (!data) return
		setBusy(true)
		setMessage(null)
		const result = await postCommand('/api/editorial/times', { ...intent, videoId: data.videoId, commandId: ids.current.for(intent) })
		ids.current.settle(intent, result)
		setBusy(false)
		setMessage(result.ok ? { tone: 'ok', text: done } : { tone: 'error', text: errorText(result) })
		if (result.ok || result.status === 409) {
			if (result.ok) {
				setCorrecting(false)
				setNote('')
			}
			await load()
		}
	}

	const started = Boolean(data.effective.broadcastStartedAt)
	const corrections = Object.fromEntries(
		correctable.filter(field => fields[field] !== toLocalInput(data.effective[field])).map(field => [field, fromLocalInput(fields[field])]),
	)
	return (
		<div className="academy-panel academy-times">
			<h3 className="academy-panel__title">Broadcast and publication times</h3>
			<dl className="academy-times__list">
				{(Object.keys(labels) as (keyof Times)[]).map(field => (
					<div key={field} className="academy-times__item">
						<dt>{labels[field]}</dt>
						<dd>
							{formatTime(data.effective[field])}
							{data.effective[field] && !data.stored?.[field] ? <span className="academy-table__sub">From the imported publish date</span> : null}
						</dd>
					</div>
				))}
			</dl>
			<p className="academy-panel__footnote">
				{data.source ? `Last written by ${sources[data.source] ?? data.source}, version ${data.version}.` : 'No times recorded yet; imported values apply.'} First published is the first public
				release and never changes on republish.
			</p>
			{data.type === 'live' && !started ? (
				<div className="academy-times__row" role="group" aria-label="Schedule the stream">
					<label className="academy-actions__field" htmlFor={`${base}-schedule`}>
						<span className="academy-actions__label">Scheduled start (your time)</span>
						<input id={`${base}-schedule`} type="datetime-local" value={schedule} onChange={event => setSchedule(event.target.value)} />
					</label>
					<button
						type="button"
						className="btn btn--style-primary btn--size-small"
						disabled={busy}
						onClick={() => submit({ action: 'schedule', expectedVersion: data.version, scheduledStartAt: fromLocalInput(schedule) }, schedule ? 'Schedule saved.' : 'Schedule cleared.')}
					>
						{schedule ? 'Save schedule' : 'Clear schedule'}
					</button>
				</div>
			) : null}
			<button type="button" className="btn btn--style-secondary btn--size-small" aria-expanded={correcting} onClick={() => setCorrecting(open => !open)}>
				Correct times
			</button>
			{correcting ? (
				<div className="academy-times__correct" role="group" aria-label="Correct broadcast times">
					{correctable.map(field => (
						<label key={field} className="academy-actions__field" htmlFor={`${base}-${field}`}>
							<span className="academy-actions__label">{labels[field]} (your time)</span>
							<input id={`${base}-${field}`} type="datetime-local" value={fields[field]} onChange={event => setFields(current => ({ ...current, [field]: event.target.value }))} />
						</label>
					))}
					<label className="academy-actions__field academy-times__note" htmlFor={`${base}-note`}>
						<span className="academy-actions__label">Reason (required, kept in the audit history)</span>
						<textarea id={`${base}-note`} rows={2} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
					</label>
					<button
						type="button"
						className="btn btn--style-primary btn--size-small"
						disabled={busy || !note.trim() || Object.keys(corrections).length === 0}
						onClick={() => submit({ action: 'correct', expectedVersion: data.version, fields: corrections, note: note.trim() }, 'Times corrected.')}
					>
						Save corrections
					</button>
				</div>
			) : null}
			{message ? (
				<p className={message.tone === 'error' ? 'academy-actions__error' : 'academy-actions__ok'} role={message.tone === 'error' ? 'alert' : 'status'}>
					{message.text}
				</p>
			) : null}
			{data.history.length ? (
				<table className="academy-table academy-table--compact">
					<caption>Recent changes, newest first</caption>
					<thead>
						<tr>
							<th scope="col">When</th>
							<th scope="col">Time</th>
							<th scope="col">Change</th>
							<th scope="col">By</th>
						</tr>
					</thead>
					<tbody>
						{data.history.map(event => (
							<tr key={event.id}>
								<td>{formatTime(event.createdAt)}</td>
								<td>{labels[event.field as keyof Times] ?? event.field}</td>
								<td>
									{formatTime(event.previous)} to {formatTime(event.next)}
									{event.note ? <span className="academy-table__sub">{event.note}</span> : null}
								</td>
								<td>{event.actor === 'machine:studio' ? 'Rawkode Studio' : event.actor}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}
		</div>
	)
}
