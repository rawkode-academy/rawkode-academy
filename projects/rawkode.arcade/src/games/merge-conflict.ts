import { hasTeam, isHost, matchesAnswer, next, score, validation, type GameActor, type GameDefinition, type ValidationResult } from "./common";

export interface MergeAnswer { answer: string; aliases?: string[]; points: number }
export interface MergeRound { prompt: string; answers: MergeAnswer[] }
export interface MergeConflictContent { title: string; rounds: MergeRound[] }
export interface MergeConflictState {
	phase: "lobby" | "open" | "complete";
	roundIndex: number;
	revealed: string[];
	scores: Record<string, number>;
	audienceSubmissions: Record<string, string>;
	lastAnswer?: { teamId: string; answer: string; correct: boolean; points: number };
}
export type MergeConflictCommand =
	| { type: "start" }
	| { type: "answer"; answer: string }
	| { type: "audience-answer"; answer: string }
	| { type: "reveal" }
	| { type: "next-round" };

const roundFor = (content: MergeConflictContent, state: MergeConflictState) => content.rounds[state.roundIndex];
const validate = (content: MergeConflictContent): ValidationResult => validation(
		...(content.rounds.length ? [] : ["at least one round is required"]),
		...content.rounds.flatMap((round, index) => [
			...(round.prompt.trim() ? [] : [`round ${index + 1} needs a prompt`]),
			...(round.answers.length ? [] : [`round ${index + 1} needs answers`]),
			...round.answers.filter((answer) => answer.points < 1 || !answer.answer.trim()).map(() => `round ${index + 1} has an invalid answer`),
		]),
	);
export const mergeConflict = (content: MergeConflictContent): GameDefinition<MergeConflictContent, MergeConflictState, MergeConflictCommand> => ({
	id: "merge-conflict", name: "Merge Conflict",
	createState: () => ({ phase: "lobby", roundIndex: 0, revealed: [], scores: {}, audienceSubmissions: {} }),
	validateContent: validate,
	redact: (state, role) => {
		if (role === "host") return state;
		const { audienceSubmissions: _audienceSubmissions, ...publicState } = state;
		return publicState;
	},
	handle: (state, command, actor, now) => {
		const round = roundFor(content, state);
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "open" });
		if (command.type === "audience-answer" && actor.role === "audience" && state.phase === "open" && round) {
			return next(state, { audienceSubmissions: { ...state.audienceSubmissions, [actor.id]: command.answer } });
		}
		if (command.type === "answer" && hasTeam(actor) && state.phase === "open" && round) {
			const found = round.answers.find((item) => !state.revealed.includes(item.answer) && matchesAnswer(command.answer, item.answer, item.aliases));
			if (!found) return next(state, { lastAnswer: { teamId: actor.teamId, answer: command.answer, correct: false, points: 0 } });
			return next(state, {
				revealed: [...state.revealed, found.answer], scores: score(state.scores, actor.teamId, found.points),
				lastAnswer: { teamId: actor.teamId, answer: found.answer, correct: true, points: found.points },
			});
		}
		if (command.type === "reveal" && isHost(actor) && state.phase === "open" && round) return next(state, { revealed: round.answers.map((item) => item.answer) });
		if (command.type === "next-round" && isHost(actor) && state.phase === "open") {
			if (state.roundIndex + 1 >= content.rounds.length) return next(state, { phase: "complete" });
			return next(state, { roundIndex: state.roundIndex + 1, revealed: [], audienceSubmissions: {}, lastAnswer: undefined });
		}
		return state;
	},
});

export const createMergeConflict = mergeConflict;
