/**
 * A news story is public once its publication time has passed. News used to
 * be built into static pages, so discovery was capped at the deployment's
 * build time; stories are now served live, so the comparison is against the
 * request time and a scheduled story appears on time without a deploy
 * (content pages cap their CDN cache lifetime at the next scheduled story,
 * see setContentCache in src/lib/live-content/cache-control.ts).
 */
export function isNewsPublished(publishedAt: Date, now = new Date()): boolean {
	const timestamp = publishedAt.getTime();
	return Number.isFinite(timestamp) && timestamp <= now.getTime();
}
