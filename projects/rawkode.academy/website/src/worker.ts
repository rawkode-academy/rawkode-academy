// Worker entrypoint (wrangler.jsonc "main"): Astro's request handler plus the
// hourly content change detection (and the daily analytics refresh) on the cron trigger "0 * * * *".

import { cache } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import { isWarmTime, warmAnalytics } from "./lib/analytics/warm";
import { runChangeDetection } from "./lib/live-content/change-detection";
import type { ContentEnv } from "./lib/live-content/env";
import { workersCachePurge } from "./lib/live-content/invalidate";
import { guardSharedCache } from "./lib/live-content/personalisation";
import {
	applyRobotsNoindexHeader,
	isNonProductionHost,
} from "./middleware/robots";

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
		if (!contentEnv.CONTENT_CACHE) {
			console.error(
				"[content] change detection skipped: CONTENT_CACHE is not bound",
			);
			return;
		}
		if (isWarmTime(controller.scheduledTime)) {
			ctx.waitUntil(warmAnalytics(env as unknown as Parameters<typeof warmAnalytics>[0]));
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
