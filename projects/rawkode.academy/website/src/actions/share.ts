import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import { captureServerEvent, getDistinctId } from "../server/analytics";

const ShareEventSchema = z.object({
	action: z.enum(["share"]),
	platform: z.enum(["clipboard", "bluesky", "linkedin", "reddit", "twitter"]),
	content_type: z.enum(["video", "article", "page"]),
	content_id: z.string(),
	success: z.boolean().default(true),
});

export const trackShareEvent = defineAction({
	input: ShareEventSchema,
	handler: async (event, ctx) => {
		try {
			const analytics = env.ANALYTICS;

			const distinctId = getDistinctId(ctx);

			await captureServerEvent(
				{
					event: "share",
					distinctId,
					properties: {
						url: `${event.content_type}/${event.content_id}`,
						channel: event.platform,
						success: event.success,
					},
				},
				analytics,
			);

			const success = true;

			return {
				success,
			};
		} catch (error) {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					error instanceof Error
						? error.message
						: "Failed to process share event",
			});
		}
	},
});
