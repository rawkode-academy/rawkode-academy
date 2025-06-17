import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

const ReactionSchema = z.object({
	contentId: z.string(),
	emoji: z.string().emoji(),
	contentTimestamp: z.number().optional(),
});

// Use the deployed URL in production, localhost in development
const EMOJI_SERVICE_URL = import.meta.env.PROD
	? "https://platform-emoji-reactions-write-model.rawkode-academy.workers.dev"
	: "http://localhost:8787"; // Local wrangler dev port

export const addReaction = defineAction({
	input: ReactionSchema,
	handler: async ({ contentId, emoji, contentTimestamp }, ctx) => {
		try {
			// Check if user is authenticated
			const user = ctx.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be signed in to react to content",
				});
			}

			// Call the emoji reactions service via HTTP
			const response = await fetch(EMOJI_SERVICE_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					contentId,
					personId: user.sub,
					emoji,
					contentTimestamp: contentTimestamp ?? 0,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: error.error || "Failed to add reaction",
				});
			}

			const result = await response.json();

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
					error instanceof Error ? error.message : "Failed to add reaction",
			});
		}
	},
});

export const removeReaction = defineAction({
	input: ReactionSchema,
	handler: async ({ contentId, emoji, contentTimestamp }, ctx) => {
		// For now, just return success - removal can be implemented later
		// when the write model supports it
		return {
			success: true,
			message: "Reaction removal will be available soon",
		};
	},
});
