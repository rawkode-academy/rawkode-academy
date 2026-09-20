// Replaced with a numeric literal by astro.config.mts, never by a worker clock.
declare const __NEWS_DEPLOYMENT_CUTOFF_MS__: number;
const deploymentCutoff = __NEWS_DEPLOYMENT_CUTOFF_MS__;
if (!Number.isFinite(deploymentCutoff)) {
	throw new Error("News deployment publication cutoff must be configured");
}

/** Discovery cannot outpace the static detail pages in this deployment. */
export function isNewsPublished(publishedAt: Date, now = new Date()): boolean {
	const timestamp = publishedAt.getTime();
	return (
		Number.isFinite(timestamp) &&
		timestamp <= Math.min(now.getTime(), deploymentCutoff)
	);
}
