import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const newsletter = {
	subscribe: defineAction({
		input: z.object({
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const result = await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
				context.locals.user.id,
				{
					audience: "academy",
					channel: "newsletter",
					status: "subscribed",
					source: input.source || "website-cta",
				},
			);

			return {
				success: true,
				...result,
			};
		},
	}),
};
