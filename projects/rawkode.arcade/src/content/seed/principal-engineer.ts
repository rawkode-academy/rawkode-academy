import type { PrincipalEngineerContent } from "../../games/principal-engineer";
export const principalEngineerSeed: PrincipalEngineerContent = { title: "Who Wants to Be a Principal Engineer?", questions: [
	{ prompt: "Which HTTP method is defined as idempotent?", choices: ["POST", "PATCH", "PUT", "CONNECT"], correct: 2, prize: 100 },
	{ prompt: "What does CAP's P denote?", choices: ["Persistence", "Partition tolerance", "Performance", "Portability"], correct: 1, prize: 1000 },
] };
