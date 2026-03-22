import type { Competitor, Match, NewMatch } from "@/db/schema";

export function nextPowerOf2(n: number): number {
	let power = 1;
	while (power < n) {
		power *= 2;
	}
	return power;
}

export function sortBySeed(competitors: Competitor[]): Competitor[] {
	return [...competitors].sort((a, b) => {
		if (a.seed === null && b.seed === null) return 0;
		if (a.seed === null) return 1;
		if (b.seed === null) return -1;
		return a.seed - b.seed;
	});
}

export function getStandardSeedOrder(bracketSize: number): number[] {
	if (bracketSize === 1) return [0];
	if (bracketSize === 2) return [0, 1];

	const halfSize = bracketSize / 2;
	const halfOrder = getStandardSeedOrder(halfSize);

	const result: number[] = [];
	for (const seed of halfOrder) {
		result.push(seed);
		result.push(bracketSize - 1 - seed);
	}

	return result;
}

export function generateSingleEliminationBracket(
	bracketId: string,
	competitors: Competitor[],
): NewMatch[] {
	const confirmed = competitors.filter((c) => c.confirmed);
	const seeded = sortBySeed(confirmed);

	if (seeded.length < 2) {
		throw new Error("Need at least 2 confirmed competitors to generate a bracket");
	}

	const bracketSize = nextPowerOf2(seeded.length);
	const totalRounds = Math.log2(bracketSize);
	const seedOrder = getStandardSeedOrder(bracketSize);

	const orderedCompetitors: (Competitor | null)[] = seedOrder.map((seedIndex) =>
		seeded[seedIndex] ?? null,
	);

	const matches: NewMatch[] = [];

	const firstRoundMatchCount = bracketSize / 2;
	for (let i = 0; i < firstRoundMatchCount; i++) {
		const competitor1 = orderedCompetitors[i * 2];
		const competitor2 = orderedCompetitors[i * 2 + 1];

		const isBye = competitor1 === null || competitor2 === null;
		const byeWinner = competitor1 ?? competitor2;

		matches.push({
			bracketId,
			round: 1,
			position: i,
			competitor1Id: competitor1?.id ?? null,
			competitor2Id: competitor2?.id ?? null,
			winnerId: isBye ? byeWinner?.id ?? null : null,
			status: isBye ? "completed" : "pending",
			completedAt: isBye ? new Date() : null,
		});
	}

	for (let round = 2; round <= totalRounds; round++) {
		const matchCount = bracketSize / Math.pow(2, round);
		for (let position = 0; position < matchCount; position++) {
			matches.push({
				bracketId,
				round,
				position,
				competitor1Id: null,
				competitor2Id: null,
				winnerId: null,
				status: "pending",
			});
		}
	}

	return advanceByeWinners(matches);
}

function advanceByeWinners(matches: NewMatch[]): NewMatch[] {
	const maxRound = Math.max(...matches.map((m) => m.round));

	for (let round = 1; round < maxRound; round++) {
		const currentRoundMatches = matches.filter((m) => m.round === round);
		const nextRoundMatches = matches.filter((m) => m.round === round + 1);

		for (const match of currentRoundMatches) {
			if (match.winnerId && match.status === "completed") {
				const nextPosition = Math.floor(match.position / 2);
				const nextMatch = nextRoundMatches.find((m) => m.position === nextPosition);

				if (nextMatch) {
					const slot = match.position % 2 === 0 ? "competitor1Id" : "competitor2Id";
					nextMatch[slot] = match.winnerId;
				}
			}
		}
	}

	return matches;
}

export function getNextMatch(
	matches: Match[],
	completedMatch: Match,
): Match | null {
	const nextRound = completedMatch.round + 1;
	const nextPosition = Math.floor(completedMatch.position / 2);

	return (
		matches.find(
			(m) => m.round === nextRound && m.position === nextPosition,
		) ?? null
	);
}

export function getWinnerSlot(
	matchPosition: number,
): "competitor1Id" | "competitor2Id" {
	return matchPosition % 2 === 0 ? "competitor1Id" : "competitor2Id";
}

export function getTotalRounds(competitorCount: number): number {
	const bracketSize = nextPowerOf2(competitorCount);
	return Math.log2(bracketSize);
}

export function getRoundName(round: number, totalRounds: number): string {
	const roundsFromFinal = totalRounds - round;

	switch (roundsFromFinal) {
		case 0:
			return "Final";
		case 1:
			return "Semi-Finals";
		case 2:
			return "Quarter-Finals";
		default:
			return `Round ${round}`;
	}
}

export function isBracketComplete(matches: Match[]): boolean {
	const maxRound = Math.max(...matches.map((m) => m.round));
	const finalMatch = matches.find((m) => m.round === maxRound);
	return finalMatch?.status === "completed" && finalMatch?.winnerId !== null;
}

export function getChampion(
	matches: Match[],
	competitors: Competitor[],
): Competitor | null {
	const maxRound = Math.max(...matches.map((m) => m.round));
	const finalMatch = matches.find((m) => m.round === maxRound);

	if (!finalMatch?.winnerId) return null;

	return competitors.find((c) => c.id === finalMatch.winnerId) ?? null;
}
