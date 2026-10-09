import { queueState, queueStatusLabels, reviewStateLabels, type QueueStatus } from '../../review/queue'

export function ReviewStatePill({ state }: { state: string | null }) {
	const key = queueState(state)
	return <span className={`academy-pill academy-pill--${key}`}>{reviewStateLabels[key]}</span>
}

export function QueueStatusPill({ status }: { status: QueueStatus }) {
	return <span className={`academy-pill academy-pill--${status}`}>{queueStatusLabels[status]}</span>
}

const statusLabels: Record<string, string> = { draft: 'Draft', published: 'Published' }
export function StatusPill({ status }: { status: unknown }) {
	const key = typeof status === 'string' && status in statusLabels ? status : 'draft'
	return <span className={`academy-pill academy-pill--${key}`}>{statusLabels[key]}</span>
}
