import type { MergeConflictContent } from "../../games/merge-conflict";

export const mergeConflictSeed: MergeConflictContent = {
	title: "What did developers blame in the retro?",
	rounds: [
		{
			prompt: "Name something a developer says when production breaks.",
			answers: [
				{ answer: "It works on my machine", aliases: ["works on my machine", "wom m"], points: 38 },
				{ answer: "Check the logs", aliases: ["look at the logs"], points: 25 },
				{ answer: "Rollback", aliases: ["roll it back", "revert it"], points: 18 },
				{ answer: "DNS", aliases: ["its dns", "it is dns"], points: 12 },
				{ answer: "Cache", aliases: ["clear the cache"], points: 7 },
			],
		},
		{
			prompt: "Name a thing engineers forget before a live demo.",
			answers: [
				{ answer: "Environment variables", aliases: ["env vars", "environment vars"], points: 33 },
				{ answer: "Wi-Fi", aliases: ["wifi", "internet"], points: 28 },
				{ answer: "Database migration", aliases: ["migrations", "migration"], points: 20 },
				{ answer: "Screen sharing", aliases: ["share screen"], points: 11 },
				{ answer: "The password", aliases: ["password", "credentials"], points: 8 },
			],
		},
	],
};
