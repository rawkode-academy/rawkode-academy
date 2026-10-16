import { handle } from "@astrojs/cloudflare/handler";
import type { StudioEnv } from "./env";
import { reconcileReviewRecordings } from "./server/payload-handoff";

// Custom Worker entry: Astro serves every request, and a 5 minute cron retries
// the Payload review handoff, polls for publication and promotes approved
// recordings. Nothing on the live or recording path waits for this.
export default {
	fetch: (request, env, context) => handle(request, env as Env, context),
	async scheduled(_controller, env, context) {
		context.waitUntil(
			reconcileReviewRecordings(env, Math.floor(Date.now() / 1000)).then(
				(results) => {
					if (results.length) {
						console.log("studio_review_reconcile", JSON.stringify(results));
					}
				},
			),
		);
	},
} satisfies ExportedHandler<StudioEnv>;
