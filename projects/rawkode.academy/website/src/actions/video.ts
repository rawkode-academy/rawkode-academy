import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	captureServerEvent,
	getAnonDistinctIdFromCookies,
} from "../server/posthog";

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

			// Map the action to the appropriate analytics method
			let success = false;
			const extra: Record<string, unknown> = {};
			const distinctId =
				ctx.locals.user?.sub ||
				(ctx.request ? getAnonDistinctIdFromCookies(ctx.request) : undefined) ||
				undefined;

			switch (event.action) {
				case "played":
				case "paused":
				case "seeked":
					await captureServerEvent({
						event:
							event.action === "played"
								? "video_play"
								: event.action === "paused"
									? "video_pause"
									: "video_seek",
						distinctId,
						properties: {
							video_id: event.video,
							position: event.seconds,
						},
					});
					success = true;
					break;
				case "progressed":
					extra.percent = event.percent;
					await captureServerEvent({
						event: "video_progress",
						distinctId,
						properties: {
							video_id: event.video,
							percent: event.percent,
						},
					});
					success = true;
					break;
				case "completed":
					await captureServerEvent({
						event: "video_complete",
						distinctId,
						properties: { video_id: event.video },
					});
					success = true;
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
