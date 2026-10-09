// Browser helpers for the guarded staff commands. Each user intent gets one
// commandId, reused on retry after a network or server failure, so a retried
// click can never apply twice: the server journal returns the first result.
export type CommandResult = { ok: boolean; status: number; data: Record<string, unknown> }

export async function postCommand(path: string, body: Record<string, unknown>): Promise<CommandResult> {
	try {
		const response = await fetch(path, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		})
		const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
		return { ok: response.ok, status: response.status, data }
	} catch {
		return { ok: false, status: 0, data: { error: 'Network error; retry' } }
	}
}

export async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(path, { credentials: 'same-origin', headers: { accept: 'application/json' } })
	const data = (await response.json().catch(() => ({}))) as T & { error?: string }
	if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
	return data
}

// Keyed by the intent (action plus its inputs). A changed input is a new intent.
export class CommandIds {
	private ids = new Map<string, string>()
	for(intent: unknown): string {
		const key = JSON.stringify(intent)
		let id = this.ids.get(key)
		if (!id) {
			id = crypto.randomUUID()
			this.ids.set(key, id)
		}
		return id
	}
	// Keep the id only when the outcome is unknown (network or 5xx); a definite
	// answer ends the intent.
	settle(intent: unknown, result: CommandResult) {
		if (result.status !== 0 && result.status < 500) this.ids.delete(JSON.stringify(intent))
	}
}

// A 409 is not always a race: publish also refuses changed bytes or a stale
// approval, so the server's reason is shown whenever it sent one.
export const errorText = (result: CommandResult) => {
	const reason = typeof result.data.error === 'string' ? result.data.error : null
	if (result.status === 409) return reason ? `${reason.replace(/\.$/, '')}. Reloaded.` : 'Changed elsewhere; reloading.'
	return reason ?? `Request failed (${result.status})`
}

// datetime-local works in the viewer's zone; commands carry UTC ISO strings.
export function toLocalInput(iso: string | null | undefined): string {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
	return local.toISOString().slice(0, 16)
}
export function fromLocalInput(value: string): string | null {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
