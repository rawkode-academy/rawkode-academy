const units: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31_536_000],
	['month', 2_592_000],
	['week', 604_800],
	['day', 86_400],
	['hour', 3_600],
	['minute', 60],
]
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(value: unknown, now = Date.now()): string {
	const time = typeof value === 'string' || value instanceof Date ? new Date(value).getTime() : Number.NaN
	if (Number.isNaN(time)) return 'unknown'
	const seconds = Math.round((time - now) / 1000)
	for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
	return 'just now'
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
