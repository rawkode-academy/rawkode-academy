import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import { thumbnailKey, type ThumbnailWorkflowParams } from "./contracts";
import type { Env } from "./env";
import { generateAndStoreThumbnail, thumbnailExists } from "./generator";

export class GenerateVideoThumbnailWorkflow extends WorkflowEntrypoint<
	Env,
	ThumbnailWorkflowParams
> {
	async run(event: WorkflowEvent<ThumbnailWorkflowParams>, step: WorkflowStep) {
		const params = event.payload;

		const exists = await step.do("check if thumbnail exists", () =>
			thumbnailExists(this.env, params)
		);
		if (exists) {
			return { success: true, skipped: true, key: thumbnailKey(params.videoId) };
		}

		const result = await step.do(
			"generate and store thumbnail",
			{
				retries: {
					limit: 3,
					delay: "1 minute",
					backoff: "exponential",
				},
				timeout: "10 minutes",
			},
			() => generateAndStoreThumbnail(this.env, params),
		);

		return { success: true, skipped: false, ...result };
	}
}
