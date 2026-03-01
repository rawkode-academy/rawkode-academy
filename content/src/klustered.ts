import { z } from "zod";
import yaml from "yaml";

const optionalDateSchema = z.preprocess((value) => {
	if (value === undefined) return undefined;
	if (value === null || value === "") return null;
	if (value instanceof Date) return value;
	if (typeof value === "string") return new Date(value);
	return value;
}, z.date().nullable()).optional();

const competitorSchema = z.object({
	id: z.string(),
	bracketId: z.string().optional(),
	name: z.string(),
	displayName: z.string().nullable().optional(),
	imageUrl: z.string().url().nullable().optional(),
	seed: z.number().int().positive().nullable().optional(),
	userId: z.string().nullable().optional(),
	confirmed: z.boolean().optional().default(true),
	confirmedAt: optionalDateSchema,
});

const matchSchema = z.object({
	id: z.string(),
	bracketId: z.string().optional(),
	round: z.number().int().positive(),
	position: z.number().int().nonnegative(),
	competitor1Id: z.string().nullable().optional(),
	competitor2Id: z.string().nullable().optional(),
	winnerId: z.string().nullable().optional(),
	status: z.enum(["pending", "scheduled", "live", "completed"]).optional().default("pending"),
	scheduledAt: optionalDateSchema,
	completedAt: optionalDateSchema,
	streamUrl: z.string().url().nullable().optional(),
	vodUrl: z.string().url().nullable().optional(),
	notes: z.string().nullable().optional(),
});

const bracketSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	description: z.string().nullable().optional(),
	type: z.enum(["solo", "team"]),
	status: z.enum(["draft", "registration", "active", "completed"]).optional().default("draft"),
	createdAt: optionalDateSchema,
	updatedAt: optionalDateSchema,
	startedAt: optionalDateSchema,
	completedAt: optionalDateSchema,
	competitors: z.array(competitorSchema).default([]),
	matches: z.array(matchSchema).default([]),
});

export type KlusteredCompetitor = z.infer<typeof competitorSchema> & { bracketId: string };
export type KlusteredMatch = z.infer<typeof matchSchema> & { bracketId: string };
export type KlusteredBracket = z.infer<typeof bracketSchema> & {
	competitors: KlusteredCompetitor[];
	matches: KlusteredMatch[];
};

const bracketFiles = import.meta.glob("../klustered/brackets/*.yaml", {
	as: "raw",
	eager: true,
});

let cachedBrackets: KlusteredBracket[] | null = null;

export function getKlusteredBrackets(): KlusteredBracket[] {
	if (cachedBrackets) return cachedBrackets;

	const brackets = Object.entries(bracketFiles).flatMap(([path, raw]) => {
		try {
			const parsed = yaml.parse(raw as string);
			const result = bracketSchema.safeParse(parsed);
			if (!result.success) {
				console.warn("Invalid Klustered bracket YAML", path, result.error.flatten());
				return [];
			}

			const bracket = result.data;
			const normalized: KlusteredBracket = {
				...bracket,
				competitors: bracket.competitors.map((competitor) => ({
					...competitor,
					bracketId: competitor.bracketId ?? bracket.id,
				})),
				matches: bracket.matches.map((match) => ({
					...match,
					bracketId: match.bracketId ?? bracket.id,
				})),
			};

			return [normalized];
		} catch (error) {
			console.warn("Failed to load Klustered bracket YAML", path, error);
			return [];
		}
	});

	cachedBrackets = brackets;
	return brackets;
}
