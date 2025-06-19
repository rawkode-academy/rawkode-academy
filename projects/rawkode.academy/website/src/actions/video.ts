import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { Analytics, getSessionId, type AnalyticsEnv } from "../lib/analytics";

const VideoEventSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("played"),
		video: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("paused"),
		video: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("seeked"),
		video: z.string(),
		seconds: z.number(),
	}),
	z.object({
		action: z.literal("completed"),
		video: z.string(),
	}),
	z.object({
		action: z.literal("progressed"),
		video: z.string(),
		percent: z.number(),
	}),
]);

export const trackVideoEvent = defineAction({
	input: VideoEventSchema,
	handler: async (event, ctx) => {
		try {
			console.log("Video event received:", event);

			// Get session ID from request or generate new one
			const sessionId = ctx.request
				? getSessionId(ctx.request)
				: crypto.randomUUID();

			// Initialize analytics
			const analytics = new Analytics(
				ctx.locals.runtime.env as AnalyticsEnv & { CF_PAGES_BRANCH?: string },
				sessionId,
				ctx.locals.user?.sub,
			);

			// Map the action to the appropriate analytics method
			let success = false;
			const extra: Record<string, unknown> = {};

			switch (event.action) {
				case "played":
				case "paused":
				case "seeked":
					success = await analytics.trackVideoEvent(
						event.video,
						event.action === "played"
							? "play"
							: event.action === "paused"
								? "pause"
								: "seek",
						event.seconds,
					);
					break;
				case "progressed":
					extra.percent = event.percent;
					success = await analytics.trackVideoEvent(
						event.video,
						"progress",
						undefined,
						undefined,
						extra,
					);
					break;
				case "completed":
					success = await analytics.trackVideoEvent(event.video, "complete");
					break;
			}

			return {
				success,
			};
		} catch (error) {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					error instanceof Error
						? error.message
						: "Failed to process video event",
			});
		}
	},
});
