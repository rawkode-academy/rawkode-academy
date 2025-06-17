import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

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

      // Get the access token from cookies
      const accessToken = ctx.cookies.get("accessToken");
      if (!accessToken) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Missing access token",
        });
      }

      // Access the runtime environment through locals
      const runtime = ctx.locals.runtime;
      if (!runtime || !runtime.EMOJI_REACTIONS) {
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Emoji reactions service not configured",
        });
      }

      // Call the emoji reactions service via service binding
      const response = await runtime.EMOJI_REACTIONS.fetch(
        new Request("https://emoji-reactions.internal/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken.value}`, // Pass the JWT token
          },
          body: JSON.stringify({
            contentId,
            personId: user.sub,
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
  handler: async () => {
    // For now, just return success - removal can be implemented later
    // when the write model supports it
    return {
      success: true,
      message: "Reaction removal will be available soon",
    };
  },
});
