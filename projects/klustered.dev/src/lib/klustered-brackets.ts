import {
	getKlusteredBrackets,
	type KlusteredBracket,
	type KlusteredCompetitor,
	type KlusteredMatch,
} from "@rawkodeacademy/content";

export type Bracket = KlusteredBracket;
export type Competitor = KlusteredCompetitor;
export type Match = KlusteredMatch;

export type MatchWithRelations = Match & {
	bracket: Bracket | null;
	competitor1: Competitor | null;
	competitor2: Competitor | null;
	winner: Competitor | null;
};

export type BracketWithCounts = Bracket & {
	competitorCount: number;
	totalRounds: number;
	currentRound: number;
	remainingCompetitors: number;
	nextMatch: Match | null;
	champion: Competitor | null;
};

export type HomepageData = {
	brackets: BracketWithCounts[];
	liveMatches: MatchWithRelations[];
	recentCompleted: MatchWithRelations[];
	upcomingScheduled: MatchWithRelations[];
	userParticipation: { bracketId: string; confirmed: boolean }[];
};

export type FullScheduleData = {
	brackets: Bracket[];
	matches: MatchWithRelations[];
	competitors: Competitor[];
};

const visibleStatuses = new Set(["registration", "active", "completed"]);

function sortByLatestStart(a: Bracket, b: Bracket): number {
	const aTime = a.startedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
	const bTime = b.startedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
	return bTime - aTime;
}

function getNormalizedBrackets(): Bracket[] {
	return getKlusteredBrackets().map((bracket) => ({
		...bracket,
		competitors: [...bracket.competitors].sort((a, b) => {
			const aSeed = a.seed ?? Number.MAX_SAFE_INTEGER;
			const bSeed = b.seed ?? Number.MAX_SAFE_INTEGER;
			return aSeed - bSeed;
		}),
		matches: [...bracket.matches].sort((a, b) => {
			if (a.round !== b.round) return a.round - b.round;
			return a.position - b.position;
		}),
	}));
}

function flattenMatches(brackets: Bracket[]): Match[] {
	return brackets.flatMap((bracket) =>
		bracket.matches.map((match) => ({
			...match,
			bracketId: match.bracketId ?? bracket.id,
		})),
	);
}

function flattenCompetitors(brackets: Bracket[]): Competitor[] {
	return brackets.flatMap((bracket) =>
		bracket.competitors.map((competitor) => ({
			...competitor,
			bracketId: competitor.bracketId ?? bracket.id,
		})),
	);
}

function enrichMatch(
	match: Match,
	bracketMap: Map<string, Bracket>,
	competitorMap: Map<string, Competitor>,
): MatchWithRelations {
	return {
		...match,
		bracket: bracketMap.get(match.bracketId) ?? null,
		competitor1: match.competitor1Id
			? competitorMap.get(match.competitor1Id) ?? null
			: null,
		competitor2: match.competitor2Id
			? competitorMap.get(match.competitor2Id) ?? null
			: null,
		winner: match.winnerId
			? competitorMap.get(match.winnerId) ?? null
			: null,
	};
}

export function getBracketBySlug(slug: string): Bracket | null {
	const brackets = getNormalizedBrackets();
	return brackets.find((bracket) => bracket.slug === slug) ?? null;
}

export function getActiveBrackets(): Bracket[] {
	return getNormalizedBrackets()
		.filter((bracket) => bracket.status === "active")
		.sort(sortByLatestStart);
}

export function getHomepageData(): HomepageData {
	const brackets = getNormalizedBrackets();
	const visibleBrackets = brackets
		.filter((bracket) => visibleStatuses.has(bracket.status))
		.sort(sortByLatestStart);

	const allMatches = flattenMatches(visibleBrackets);
	const allCompetitors = flattenCompetitors(visibleBrackets);
	const competitorMap = new Map(allCompetitors.map((c) => [c.id, c]));
	const bracketMap = new Map(visibleBrackets.map((b) => [b.id, b]));

	const liveMatches = allMatches.filter((match) => match.status === "live");
	const recentCompleted = allMatches
		.filter((match) => match.status === "completed" && match.completedAt)
		.sort(
			(a, b) =>
				(b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
		)
		.slice(0, 5);

	const upcomingScheduled = allMatches
		.filter((match) => match.status === "scheduled" && match.scheduledAt)
		.sort(
			(a, b) =>
				(a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0),
		)
		.slice(0, 5);

	const bracketsWithCounts = visibleBrackets.map((bracket) => {
		const bracketCompetitors = allCompetitors.filter(
			(competitor) =>
				competitor.bracketId === bracket.id && competitor.confirmed,
		);
		const bracketMatches = allMatches.filter(
			(match) => match.bracketId === bracket.id,
		);

		const totalRounds = bracketMatches.length > 0
			? Math.max(...bracketMatches.map((match) => match.round))
			: 0;

		const completedRounds = bracketMatches.length > 0
			? bracketMatches.reduce((maxCompletedRound, match) => {
					const roundMatches = bracketMatches.filter(
						(roundMatch) => roundMatch.round === match.round,
					);
					const allCompleted = roundMatches.every(
						(roundMatch) => roundMatch.status === "completed",
					);
					if (allCompleted && match.round > maxCompletedRound) {
						return match.round;
					}
					return maxCompletedRound;
				}, 0)
			: 0;

		const currentRound = Math.min(completedRounds + 1, totalRounds);

		const remainingCompetitors = bracketMatches
			.filter((match) => match.round === currentRound)
			.reduce((count, match) => {
				return count + (match.competitor1Id ? 1 : 0) + (match.competitor2Id ? 1 : 0);
			}, 0);

		const nextMatch = bracketMatches
			.filter((match) => match.scheduledAt && match.status !== "completed")
			.sort(
				(a, b) =>
					(a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0),
			)[0];

		let champion: Competitor | null = null;
		if (bracket.status === "completed" && totalRounds > 0) {
			const finalMatch = bracketMatches.find(
				(match) => match.round === totalRounds && match.status === "completed",
			);
			if (finalMatch?.winnerId) {
				champion = allCompetitors.find(
					(competitor) => competitor.id === finalMatch.winnerId,
				) ?? null;
			}
		}

		return {
			...bracket,
			competitorCount: bracketCompetitors.length,
			totalRounds,
			currentRound,
			remainingCompetitors: remainingCompetitors || bracketCompetitors.length,
			nextMatch: nextMatch ?? null,
			champion,
		};
	});

	return {
		brackets: bracketsWithCounts,
		liveMatches: liveMatches.map((match) =>
			enrichMatch(match, bracketMap, competitorMap),
		),
		recentCompleted: recentCompleted.map((match) =>
			enrichMatch(match, bracketMap, competitorMap),
		),
		upcomingScheduled: upcomingScheduled.map((match) =>
			enrichMatch(match, bracketMap, competitorMap),
		),
		userParticipation: [],
	};
}

export function getFullSchedule(
	options?: { bracketId?: string; status?: "all" | "upcoming" | "live" | "completed" },
): FullScheduleData {
	const brackets = getNormalizedBrackets();
	const visibleBrackets = brackets
		.filter((bracket) => visibleStatuses.has(bracket.status))
		.sort(sortByLatestStart);

	const filteredBrackets = options?.bracketId
		? visibleBrackets.filter((bracket) => bracket.id === options.bracketId)
		: visibleBrackets;

	if (filteredBrackets.length === 0) {
		return { brackets: [], matches: [], competitors: [] };
	}

	let allMatches = flattenMatches(filteredBrackets).sort((a, b) => {
		const aTime = a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
		const bTime = b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
		if (aTime !== bTime) return aTime - bTime;
		if (a.round !== b.round) return a.round - b.round;
		return a.position - b.position;
	});

	if (options?.status && options.status !== "all") {
		if (options.status === "upcoming") {
			allMatches = allMatches.filter(
				(match) => match.status === "scheduled" || match.status === "pending",
			);
		} else if (options.status === "live") {
			allMatches = allMatches.filter((match) => match.status === "live");
		} else if (options.status === "completed") {
			allMatches = allMatches.filter((match) => match.status === "completed");
		}
	}

	const allCompetitors = flattenCompetitors(filteredBrackets);
	const competitorMap = new Map(allCompetitors.map((c) => [c.id, c]));
	const bracketMap = new Map(filteredBrackets.map((b) => [b.id, b]));

	return {
		brackets: filteredBrackets,
		matches: allMatches.map((match) =>
			enrichMatch(match, bracketMap, competitorMap),
		),
		competitors: allCompetitors,
	};
}
