import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { captureServerEvent, getDistinctId } from "../server/posthog";

const ReactionSchema = z.object({
	contentId: z.string(),
	emoji: z.string().emoji(),
	contentTimestamp: z.number().optional(),
});

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

			// Access the runtime environment through locals
			const runtime = ctx.locals.runtime;
			if (!runtime || !runtime.env.EMOJI_REACTIONS) {
				// Log debugging information
				console.error("Runtime debug info:", {
					hasRuntime: !!runtime,
					hasLocals: !!ctx.locals,
					localsKeys: ctx.locals ? Object.keys(ctx.locals) : [],
					runtimeKeys: runtime ? Object.keys(runtime) : [],
				});

				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Emoji reactions service not configured",
				});
			}

			// Call the emoji reactions service via service binding
			// NOTE: personId uses Better Auth's user.id (UUID format). The emoji-reactions service
			// automatically resolves this to the canonical user ID, handling both legacy Zitadel subject IDs
			// and new Better Auth UUIDs transparently. Service binding requests are internal
			// (no Origin/Authorization headers), so the emoji-reactions service skips auth validation.
			// See platform/emoji-reactions/IDENTITY_MIGRATION.md for details on identity continuity.
			const response = await runtime.env.EMOJI_REACTIONS.fetch(
				new Request("https://emoji-reactions.internal/", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						contentId,
						personId: user.id,
						emoji,
						contentTimestamp: contentTimestamp ?? 0,
					}),
				}),
			);

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: errorData.error || "Failed to add reaction",
				});
			}

			const result = (await response.json()) as Record<string, unknown>;

			// Track the reaction event
			const distinctId = getDistinctId(ctx);
			await captureServerEvent({
				event: "reaction_add",
				distinctId,
				properties: { content_id: contentId, emoji },
			});

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
	handler: async ({ contentId, emoji }, ctx) => {
		// Track the reaction removal event
		const distinctId = getDistinctId(ctx);
		await captureServerEvent({
			event: "reaction_remove",
			distinctId,
			properties: { content_id: contentId, emoji },
		});

		// For now, just return success - removal can be implemented later
		// when the write model supports it
		return {
			success: true,
			message: "Reaction removal will be available soon",
		};
	},
});
