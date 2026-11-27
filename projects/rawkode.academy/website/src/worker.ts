// Worker entrypoint (wrangler.jsonc "main"): Astro's request handler plus the
// hourly content change detection on the cron trigger "0 * * * *".

import { cache } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import { refreshSnapshot } from "./lib/analytics/snapshot";
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
			const vars = env as unknown as {
				BASIN_BUCKET?: string;
				BASIN_SQL_TOKEN?: string;
				CLOUDFLARE_ACCOUNT_ID?: string;
			};
			if (!contentEnv.CONTENT_CACHE || !vars.BASIN_SQL_TOKEN) {
				console.error("[analytics] snapshot skipped: KV or Basin token missing");
				return;
			}
			ctx.waitUntil(
				refreshSnapshot(
					{
						accountId: vars.CLOUDFLARE_ACCOUNT_ID ?? "",
						bucket: vars.BASIN_BUCKET ?? "rawkode-analytics",
						token: vars.BASIN_SQL_TOKEN,
					},
					contentEnv.CONTENT_CACHE,
					new Date(),
					contentEnv,
				).catch((error) => {
					console.error(
						JSON.stringify({
							event: "analytics.snapshot.failed",
							error: error instanceof Error ? error.message : String(error),
						}),
					);
					throw error;
				}),
			);
			return;
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
