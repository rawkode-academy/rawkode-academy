import type { CncfStatus, Round } from "./guess-the-logo";

export const NAMESPACE = "guess-the-logo";

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
	{
		id: "perfect-run",
		name: "Perfect Run",
		description: "Identify all 10 logos correctly.",
		icon: "💯",
	},
	{
		id: "halfway-there",
		name: "Halfway There",
		description: "Get at least 5 logos correct.",
		icon: "🪜",
	},
	{
		id: "sandbox-surfer",
		name: "Sandbox Surfer",
		description: "Correctly identify every CNCF Sandbox logo in the run.",
		icon: "🏄",
	},
	{
		id: "incubating-insider",
		name: "Incubating Insider",
		description: "Correctly identify every CNCF Incubating logo in the run.",
		icon: "🥚",
	},
	{
		id: "graduated-genius",
		name: "Graduated Genius",
		description: "Correctly identify every CNCF Graduated logo in the run.",
		icon: "🎓",
	},
	{
		id: "non-cncf-hero",
		name: "Non-CNCF Hero",
		description: "Correctly identify every non-CNCF logo in the run.",
		icon: "🦸",
	},
];

/**
 * Pure evaluation of which achievements were earned in a completed game.
 *
 * Category rule (sandbox / incubating / graduated / non-cncf):
 *   >=1 logo of that cncfStatus appears in the run AND every one of them
 *   was answered correctly.
 *
 * non-cncf-hero uses cncfStatus === null.
 */
export function evaluateAchievements(
	rounds: Round[],
	answers: (string | null)[],
): string[] {
	const earned: string[] = [];

	// Count correct answers
	let correct = 0;
	for (let i = 0; i < rounds.length; i++) {
		const round = rounds[i];
		if (round && answers[i] !== null && answers[i] === round.answer) {
			correct++;
		}
	}

	// perfect-run: 10/10
	if (correct === rounds.length && rounds.length === 10) {
		earned.push("perfect-run");
	}

	// halfway-there: >=5 correct
	if (correct >= 5) {
		earned.push("halfway-there");
	}

	// Category helper — checks that a given status has >=1 logo AND all correct
	function categoryEarned(status: CncfStatus): boolean {
		const matching = rounds.reduce<number[]>((acc, round, i) => {
			if (round.logo.cncfStatus === status) acc.push(i);
			return acc;
		}, []);

		if (matching.length === 0) return false;

		return matching.every((i) => {
			const round = rounds[i];
			return round && answers[i] !== null && answers[i] === round.answer;
		});
	}

	if (categoryEarned("sandbox")) {
		earned.push("sandbox-surfer");
	}

	if (categoryEarned("incubating")) {
		earned.push("incubating-insider");
	}

	if (categoryEarned("graduated")) {
		earned.push("graduated-genius");
	}

	// non-cncf-hero: cncfStatus === null
	if (categoryEarned(null)) {
		earned.push("non-cncf-hero");
	}

	return earned;
}
