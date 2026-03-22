import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	getActiveBrackets,
	getBracketBySlug,
	getFullSchedule as getFullScheduleData,
	getHomepageData,
} from "@/lib/klustered-brackets";

export const bracket = {
	getBracket: defineAction({
		input: z.object({
			slug: z.string(),
		}),
		handler: async (input) => {
			const bracketData = getBracketBySlug(input.slug);
			if (!bracketData) {
				throw new Error("Bracket not found");
			}

			return {
				bracket: bracketData,
				competitors: bracketData.competitors,
				matches: bracketData.matches,
			};
		},
	}),

	getActiveBrackets: defineAction({
		handler: async () => getActiveBrackets(),
	}),

	getHomepageData: defineAction({
		handler: async () => getHomepageData(),
	}),

	getFullSchedule: defineAction({
		input: z
			.object({
				bracketId: z.string().optional(),
				status: z.enum(["all", "upcoming", "live", "completed"]).optional(),
			})
			.optional(),
		handler: async (input) => getFullScheduleData(input),
	}),
};
