/** News has no draft field: its publication date gates build-time visibility. */
export function isNewsPublished(publishedAt: Date, now = new Date()): boolean {
	const timestamp = publishedAt.getTime();
	return Number.isFinite(timestamp) && timestamp <= now.getTime();
}
