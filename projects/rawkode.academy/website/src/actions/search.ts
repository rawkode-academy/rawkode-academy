import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const search = defineAction({
	input: z.object({
		query: z.string().min(2, "Search query must be at least 2 characters"),
	}),
	handler: async (input, context) => {
		const answer = await context.locals.runtime.env.AI.autorag(
			"polished-king-01e0",
		).aiSearch({
			query: input.query,
		});

		return answer;
	},
});
