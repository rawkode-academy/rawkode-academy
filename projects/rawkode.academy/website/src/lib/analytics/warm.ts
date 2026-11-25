// Daily refresh of the numbers /analytics shows. The page reads them from KV
// (see `daily` in server/basin.ts); this runs the Basin queries once a day
// from the cron trigger so no visitor waits for them.
import type { ContentEnv } from "@/lib/live-content/env";
import { lakeCatalogueSql } from "../../../../../../packages/guest-scope/index";
import { reachQueries, reachWindow } from "@/lib/analytics/reach";
import { basinQuery } from "@/server/basin";

/** The cron fires hourly; the analytics numbers refresh at this UTC hour. */
export const WARM_HOUR_UTC = 0;

type WarmEnv = ContentEnv & {
	BASIN_BUCKET?: string;
	BASIN_SQL_TOKEN?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
};

export function isWarmTime(scheduledTime: number): boolean {
	return new Date(scheduledTime).getUTCHours() === WARM_HOUR_UTC;
}

export async function warmAnalytics(env: WarmEnv): Promise<number> {
	const config = {
		accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
		bucket: env.BASIN_BUCKET ?? "rawkode-analytics",
		token: env.BASIN_SQL_TOKEN ?? "",
	};
	if (!config.accountId || !config.token || !env.CONTENT_CACHE) return 0;
	const sql = [...Object.values(reachQueries(reachWindow())), lakeCatalogueSql];
	const results = await Promise.allSettled(
		sql.map((query) =>
			basinQuery(config, query, {
				daily: env.CONTENT_CACHE,
				refresh: true,
			}),
		),
	);
	const failed = results.filter((result) => result.status === "rejected");
	if (failed.length > 0) {
		console.error(
			JSON.stringify({
				event: "analytics.warm.failed",
				failed: failed.length,
				of: results.length,
			}),
		);
	}
	return results.length - failed.length;
}
