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
	accent: "cyan" | "violet" | "lime" | "amber" | "coral" | "pink";
	mode: "survey" | "puzzle" | "ladder" | "chase" | "list" | "rare";
	players: string;
};

export const games: readonly GameDefinition[] = [
	{
		id: "merge-conflict",
		title: "Merge Conflict",
		kicker: "Survey showdown",
		description: "Teams merge the answers developers gave most often.",
		mechanic: "Ranked answers · audience poll",
		accent: "cyan",
		mode: "survey",
		players: "2–6 teams",
	},
	{
		id: "spinlock",
		title: "Spinlock",
		kicker: "Phrase puzzle",
		description: "Solve technical phrases before the build turns red.",
		mechanic: "Wheel · letters · lightning solve",
		accent: "violet",
		mode: "puzzle",
		players: "2–4 teams",
	},
	{
		id: "principal-engineer",
		title: "Who Wants to Be a Principal Engineer?",
		kicker: "The career ladder",
		description: "Climb from intern to principal under the studio lights.",
		mechanic: "15 questions · lifelines",
		accent: "amber",
		mode: "ladder",
		players: "Solo or teams",
	},
	{
		id: "race-condition",
		title: "Race Condition",
		kicker: "Beat the expert",
		description: "Outrun the Chaser across a perilous engineering board.",
		mechanic: "Buzzers · head-to-head",
		accent: "coral",
		mode: "chase",
		players: "1–5 contestants",
	},
	{
		id: "ten-nines",
		title: "Ten Nines",
		kicker: "Complete the list",
		description: "Name ten things every excellent engineer should know.",
		mechanic: "Lists · team relay",
		accent: "lime",
		mode: "list",
		players: "2–6 teams",
	},
	{
		id: "null-pointer",
		title: "Null Pointer",
		kicker: "Rare is rewarded",
		description: "Find the right answers no one else thought of.",
		mechanic: "Audience distribution · reverse scoring",
		accent: "pink",
		mode: "rare",
		players: "Any audience",
	},
] as const;

export const gameById = (id: string | undefined) =>
	games.find((game) => game.id === id) ?? games[0];
