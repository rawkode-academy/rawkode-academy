/** Payload controls publication; request-time surfaces follow the current clock. */
export function isNewsPublished(publishedAt: Date, now = new Date()): boolean {
	const timestamp = publishedAt.getTime();
	return Number.isFinite(timestamp) && timestamp <= now.getTime();
}
