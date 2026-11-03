import { handle } from "@astrojs/cloudflare/handler";
import type { StudioEnv } from "./env";
import { reapWhipProviderAttempts } from "./server/whip-provider-lifecycle";

export default {
	fetch: handle,
	async scheduled(_controller: ScheduledController, env: StudioEnv): Promise<void> {
		const result = await reapWhipProviderAttempts(env);
		if (result.pending > 0) {
			console.warn("WHIP provider retirement requires further reconciliation", { pending: result.pending });
		}
	},
};
