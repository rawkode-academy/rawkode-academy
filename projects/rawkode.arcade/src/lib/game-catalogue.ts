export type GameId =
	| "merge-conflict"
	| "spinlock"
	| "principal-engineer"
	| "race-condition"
	| "ten-nines"
	| "null-pointer";

export type GameDefinition = {
	id: GameId;
	title: string;
	kicker: string;
	description: string;
	mechanic: string;
	mode: "survey" | "puzzle" | "ladder" | "chase" | "list" | "rare";
	players: string;
	/**
	 * A public, answer-free visual contract. The motif is intentionally about
	 * the show's mechanic rather than a colour assignment, so a desaturated
	 * broadcast frame is still recognisable without reading its title.
	 */
	brand: {
		code: string;
		motif: "diff" | "wheel" | "ladder" | "race" | "matrix" | "void";
		boardLabel: string;
	};
};

export const games: readonly GameDefinition[] = [
	{
		id: "merge-conflict",
		title: "Merge Conflict",
		kicker: "Survey showdown",
		description: "Teams merge the answers developers gave most often.",
		mechanic: "Ranked answers · audience poll",
		mode: "survey",
		players: "2–6 teams",
		brand: { code: "MC-01", motif: "diff", boardLabel: "Ranked diff" },
	},
	{
		id: "spinlock",
		title: "Spinlock",
		kicker: "Phrase puzzle",
		description: "Solve technical phrases before the build turns red.",
		mechanic: "Wheel · letters · lightning solve",
		mode: "puzzle",
		players: "2–4 teams",
		brand: { code: "SL-02", motif: "wheel", boardLabel: "Lock wheel" },
	},
	{
		id: "principal-engineer",
		title: "Who Wants to Be a Principal Engineer?",
		kicker: "The career ladder",
		description: "Climb from intern to principal under the studio lights.",
		mechanic: "15 questions · lifelines",
		mode: "ladder",
		players: "Solo or teams",
		brand: { code: "PE-03", motif: "ladder", boardLabel: "Career ladder" },
	},
	{
		id: "race-condition",
		title: "Race Condition",
		kicker: "Beat the expert",
		description: "Outrun the Chaser across a perilous engineering board.",
		mechanic: "Buzzers · head-to-head",
		mode: "chase",
		players: "1–5 contestants",
		brand: { code: "RC-04", motif: "race", boardLabel: "Chase lanes" },
	},
	{
		id: "ten-nines",
		title: "Ten Nines",
		kicker: "Complete the list",
		description: "Name ten things every excellent engineer should know.",
		mechanic: "Lists · team relay",
		mode: "list",
		players: "2–6 teams",
		brand: { code: "TN-05", motif: "matrix", boardLabel: "Reliability matrix" },
	},
	{
		id: "null-pointer",
		title: "Null Pointer",
		kicker: "Rare is rewarded",
		description: "Find the right answers no one else thought of.",
		mechanic: "Audience distribution · reverse scoring",
		mode: "rare",
		players: "Any audience",
		brand: { code: "NP-06", motif: "void", boardLabel: "Rarity field" },
	},
] as const;

export const gameById = (id: string | undefined) =>
	games.find((game) => game.id === id) ?? games[0];
