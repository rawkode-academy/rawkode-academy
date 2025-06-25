import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Analytics, getSessionId } from "../lib/analytics";

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
			console.log("Share event received:", event);

			// Get session ID from request or use anonymous
			const sessionId = ctx.request ? getSessionId(ctx.request) : "anonymous";

			// Initialize analytics
			const analytics = new Analytics(
				ctx.locals.runtime.env,
				sessionId,
				ctx.locals.user?.sub,
			);

			// Track share event with new pipeline
			const success = await analytics.trackShare(
				`${event.content_type}/${event.content_id}`,
				event.platform,
			);

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
