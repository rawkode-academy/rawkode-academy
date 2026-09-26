import type { RaceConditionContent } from "../../games/race-condition";
export const raceConditionSeed: RaceConditionContent = { title: "Race Condition", finish: 5, rounds: [
	{ prompt: "Which data structure uses FIFO ordering?", answer: "queue", aliases: ["a queue"], teamSteps: 2, chaserSteps: 1 },
	{ prompt: "Which protocol resolves domain names?", answer: "DNS", aliases: ["domain name system"], teamSteps: 1, chaserSteps: 1 },
	{ prompt: "What command creates a Git branch and switches to it?", answer: "git switch -c", aliases: ["git checkout -b"], teamSteps: 2, chaserSteps: 1 },
] };
