// Worker entrypoint (wrangler.jsonc "main"): Astro's request handler plus the
// hourly content change detection on the cron trigger "0 * * * *".

import { cache } from "cloudflare:workers";
import { handle } from "@astrojs/cloudflare/handler";
import { runChangeDetection } from "./lib/live-content/change-detection";
import type { ContentEnv } from "./lib/live-content/env";
import { workersCachePurge } from "./lib/live-content/invalidate";
import { guardSharedCache } from "./lib/live-content/personalisation";

export default {
	async fetch(request, env, ctx) {
		const response = await handle(request, env, ctx);
		return guardSharedCache(request, response);
	},
	async scheduled(controller, env, ctx) {
		const contentEnv = env as unknown as ContentEnv;
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
