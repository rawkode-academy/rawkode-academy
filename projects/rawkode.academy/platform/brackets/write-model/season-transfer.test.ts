import { describe, expect, it } from "bun:test";
import { planSummerToWinterTransfer } from "./season-transfer";

const seasonStartDate = Date.UTC(2026, 9, 30);
const bracketStartsAt = seasonStartDate + 19 * 60 * 60 * 1000;
const sourceSeason = { id: "summer", showId: "klustered", slug: "s26" };
const targetSeason = { id: "winter", showId: "klustered", slug: "w26" };
const sourceBrackets = [
	{
		id: "summer-solo",
		seasonId: "summer",
		slug: "solo",
		name: "Solo",
		kind: "solo" as const,
		format: "single_elimination" as const,
		maxEntries: 16,
		teamSize: 4,
		cadenceDays: 7,
	},
	{
		id: "summer-team",
		seasonId: "summer",
		slug: "team",
		name: "Team",
		kind: "team" as const,
		format: "single_elimination" as const,
		maxEntries: 16,
		teamSize: 4,
		cadenceDays: 7,
	},
];

const baseInput = {
	sourceSeason,
	targetSeason,
	sourceBrackets,
	targetBrackets: [],
	applications: [
		{ bracketId: "summer-solo", competitorId: "competitor-a" },
		{ bracketId: "summer-solo", competitorId: "competitor-b" },
		{ bracketId: "summer-solo", competitorId: "competitor-c" },
		{ bracketId: "summer-team", competitorId: "competitor-a" },
	],
	sourceCompetitorIds: ["competitor-a", "competitor-b", "competitor-c"],
	targetCompetitorCount: 0,
	targetApplicationCount: 0,
	unsupportedRelatedRecords: [],
	seasonStartDate,
	bracketStartsAt,
	createBracketId: (() => {
		let next = 0;
		return () => `winter-bracket-${++next}`;
	})(),
};

describe("planSummerToWinterTransfer", () => {
	it("maps applications to active Winter brackets and preserves each competitor id", () => {
		const plan = planSummerToWinterTransfer(baseInput);

		expect(plan.applicationsMoved).toBe(4);
		expect(plan.competitorIds).toEqual(["competitor-a", "competitor-b", "competitor-c"]);
		expect(plan.sourceSeasonId).toBe("summer");
		expect(plan.targetSeasonId).toBe("winter");
		expect(plan.bracketMappings.map((mapping) => mapping.targetBracket.slug)).toEqual([
			"solo",
			"team",
		]);
		expect(plan.bracketMappings.map((mapping) => mapping.targetBracketId)).toEqual([
			"winter-bracket-1",
			"winter-bracket-2",
		]);
		expect(plan.seasonStartDate).toBe(seasonStartDate);
		expect(plan.bracketStartsAt).toBe(bracketStartsAt);
	});

	it("refuses to overwrite existing Winter brackets", () => {
		expect(() =>
			planSummerToWinterTransfer({
				...baseInput,
				targetBrackets: [
					{ ...sourceBrackets[0], id: "winter-solo", seasonId: "winter" },
				],
			}),
		).toThrow("Winter already has brackets");
	});

	it("refuses to delete Summer when unrelated records or unmatched competitors exist", () => {
		expect(() =>
			planSummerToWinterTransfer({
				...baseInput,
				unsupportedRelatedRecords: ["teams"],
			}),
		).toThrow("teams");
		expect(() =>
			planSummerToWinterTransfer({
				...baseInput,
				sourceCompetitorIds: [...baseInput.sourceCompetitorIds, "unapplied-competitor"],
			}),
		).toThrow("not represented by its applications");
	});

	it("refuses to overwrite existing Winter applications", () => {
		expect(() =>
			planSummerToWinterTransfer({ ...baseInput, targetApplicationCount: 1 }),
		).toThrow("Winter already has competitors or applications");
	});
});
