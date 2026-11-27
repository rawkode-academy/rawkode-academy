// Worker entrypoint (wrangler.jsonc "main"): Astro's request handler plus the
// hourly content change detection on the cron trigger "0 * * * *".

import { cache } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import { refreshSnapshot, SNAPSHOT_KEY } from "./lib/analytics/snapshot";
import { runChangeDetection } from "./lib/live-content/change-detection";
import type { ContentEnv } from "./lib/live-content/env";
import { workersCachePurge } from "./lib/live-content/invalidate";
import { guardSharedCache } from "./lib/live-content/personalisation";
import {
	applyRobotsNoindexHeader,
	isNonProductionHost,
} from "./middleware/robots";

// Daily, after the YouTube sync (08:17 UTC) has landed.
const ANALYTICS_CRON = "30 9 * * *";

type AnalyticsEnv = ContentEnv & {
	BASIN_BUCKET?: string;
	BASIN_SQL_TOKEN?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
};

async function refreshAnalytics(env: AnalyticsEnv): Promise<void> {
	if (!env.CONTENT_CACHE || !env.BASIN_SQL_TOKEN) {
		console.error("[analytics] snapshot skipped: KV or Basin token missing");
		return;
	}
	try {
		await refreshSnapshot(
			{
				accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
				bucket: env.BASIN_BUCKET ?? "rawkode-analytics",
				token: env.BASIN_SQL_TOKEN,
			},
			env.CONTENT_CACHE,
			new Date(),
			env,
		);
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "analytics.snapshot.failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		throw error;
	}
}

const LEGACY_REDIRECT_HOSTS = new Set(["klustered.live", "www.klustered.live"]);

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const hostname = url.hostname.trim().toLowerCase().replace(/\.$/, "");

		if (hostname === "www.rawkode.academy") {
			return new Response(null, {
				status: 301,
				headers: {
					Location: `https://rawkode.academy${url.pathname}${url.search}`,
					"Cache-Control": "no-store",
					Vary: "Host",
				},
			});
		}

		const rawResponse = await handle(request, env, ctx);
		const response = guardSharedCache(request, rawResponse);

		if (
			isNonProductionHost(hostname) &&
			!(
				LEGACY_REDIRECT_HOSTS.has(hostname) &&
				response.status >= 300 &&
				response.status < 400
			)
		) {
			return applyRobotsNoindexHeader(response);
		}

		return response;
	},
	async scheduled(controller, env, ctx) {
		const contentEnv = env as unknown as ContentEnv;
		if (controller.cron === ANALYTICS_CRON) {
			ctx.waitUntil(refreshAnalytics(env as unknown as AnalyticsEnv));
			return;
		}
		// A missing snapshot (first deploy, a new key version, an expired key) is
		// filled by the next hourly run, so no page view has to build it.
		if (contentEnv.CONTENT_CACHE) {
			const kv = contentEnv.CONTENT_CACHE;
			ctx.waitUntil(
				kv
					.get(SNAPSHOT_KEY)
					.then((stored) =>
						stored ? undefined : refreshAnalytics(env as unknown as AnalyticsEnv),
					)
					.catch(() => undefined),
			);
		}
		if (!contentEnv.CONTENT_CACHE) {
			console.error(
				"[content] change detection skipped: CONTENT_CACHE is not bound",
			);
			return;
		}
		ctx.waitUntil(
			runChangeDetection({
				env: contentEnv,
				kv: contentEnv.CONTENT_CACHE,
				purge: workersCachePurge(cache),
			}).catch((error) => {
				console.error(
					JSON.stringify({
						event: "content.change-detection.failed",
						cron: controller.cron,
						error: error instanceof Error ? error.message : String(error),
					}),
				);
				throw error;
			}),
		);
	},
} satisfies ExportedHandler<Env>;
