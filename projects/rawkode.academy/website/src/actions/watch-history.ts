import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { captureServerEvent, getDistinctId } from "../server/analytics";

const WatchPositionSchema = z.object({
	videoId: z.string(),
	positionSeconds: z.number().int().nonnegative(),
});

export const updateWatchPosition = defineAction({
	input: WatchPositionSchema,
	handler: async ({ videoId, positionSeconds }, ctx) => {
		try {
			// Check if user is authenticated
			const user = ctx.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be signed in to save watch progress",
				});
			}

			// Access the runtime environment through locals
			const runtime = ctx.locals.runtime;
			if (!runtime || !runtime.env.WATCH_HISTORY) {
				console.error("Runtime debug info:", {
					hasRuntime: !!runtime,
					hasLocals: !!ctx.locals,
					localsKeys: ctx.locals ? Object.keys(ctx.locals) : [],
					runtimeKeys: runtime ? Object.keys(runtime) : [],
				});

				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Watch history service not configured",
				});
			}

			// Call the watch history service via service binding
			const response = await runtime.env.WATCH_HISTORY.fetch(
				new Request("https://watch-history.internal/", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						videoId,
						positionSeconds,
						userId: user.id,
					}),
				}),
			);

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: errorData.error || "Failed to save watch position",
				});
			}

			const result = (await response.json()) as Record<string, unknown>;

			// Track the event for analytics
			const analytics = runtime.env.ANALYTICS;
			const distinctId = getDistinctId(ctx);
			await captureServerEvent(
				{
					event: "watch_position_update",
					distinctId,
					properties: { video_id: videoId, position_seconds: positionSeconds },
				},
				analytics,
			);

			return {
				success: true,
				...result,
			};
		} catch (error) {
			if (error instanceof ActionError) {
				throw error;
			}

			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					error instanceof Error
						? error.message
						: "Failed to save watch position",
			});
		}
	},
});
