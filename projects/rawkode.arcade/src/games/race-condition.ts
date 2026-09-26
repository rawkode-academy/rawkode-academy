import { hasTeam, isHost, matchesAnswer, next, score, validation, type GameActor, type GameDefinition, type ValidationResult } from "./common";
export interface RaceRound { prompt: string; answer: string; aliases?: string[]; teamSteps: number; chaserSteps: number }
export interface RaceConditionContent { title: string; finish: number; rounds: RaceRound[] }
export interface RaceConditionState { phase: "lobby" | "open" | "complete"; roundIndex: number; positions: Record<string, number>; chaserPosition: number; buzzed?: { teamId: string; at: number }; awaitingChaser?: boolean; settled?: boolean; audienceAnswers: Record<string, string>; scores: Record<string, number>; winner?: string }
export type RaceConditionCommand = { type: "start" } | { type: "buzz" } | { type: "answer"; answer: string } | { type: "chaser-answer"; answer: string } | { type: "audience-answer"; answer: string } | { type: "next-round" };
export const raceCondition = (content: RaceConditionContent): GameDefinition<RaceConditionContent, RaceConditionState, RaceConditionCommand> => ({
	id: "race-condition", name: "Race Condition", createState: () => ({ phase: "lobby", roundIndex: 0, positions: {}, chaserPosition: 0, audienceAnswers: {}, scores: {} }),
	validateContent: (value): ValidationResult => validation(...(value.finish > 0 ? [] : ["finish must be positive"]), ...(value.rounds.length ? [] : ["at least one round is required"]), ...value.rounds.filter((round) => !round.prompt.trim() || !round.answer.trim() || round.teamSteps < 1 || round.chaserSteps < 1).map(() => "round needs a prompt, answer, and positive steps")),
	redact: (state, role) => { if (role === "host") return state; const { audienceAnswers: _audienceAnswers, ...publicState } = state; return publicState; },
	handle: (state, command, actor, now) => {
		const round = content.rounds[state.roundIndex];
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "open" });
		if (command.type === "audience-answer" && actor.role === "audience" && state.phase === "open" && !state.settled && !state.awaitingChaser) return next(state, { audienceAnswers: { ...state.audienceAnswers, [actor.id]: command.answer } });
		if (command.type === "buzz" && hasTeam(actor) && state.phase === "open" && !state.buzzed && !state.settled && !state.awaitingChaser) return next(state, { buzzed: { teamId: actor.teamId, at: now } });
		if (command.type === "answer" && hasTeam(actor) && state.phase === "open" && !state.settled && state.buzzed?.teamId === actor.teamId && round) {
			const correct = matchesAnswer(command.answer, round.answer, round.aliases); const position = (state.positions[actor.teamId] ?? 0) + (correct ? round.teamSteps : 0); const winner = correct && position >= content.finish ? actor.teamId : state.winner;
			return next(state, { positions: { ...state.positions, [actor.teamId]: position }, scores: correct ? score(state.scores, actor.teamId, round.teamSteps * 100) : state.scores, winner, buzzed: undefined, awaitingChaser: correct ? undefined : true, settled: correct });
		}
		if (command.type === "chaser-answer" && isHost(actor) && state.phase === "open" && state.awaitingChaser && !state.settled && round) { const correct = matchesAnswer(command.answer, round.answer, round.aliases); const chaserPosition = state.chaserPosition + (correct ? round.chaserSteps : 0); return next(state, { chaserPosition, winner: correct && chaserPosition >= content.finish ? "chaser" : state.winner, awaitingChaser: undefined, settled: true }); }
		if (command.type === "next-round" && isHost(actor) && state.phase === "open") return state.winner || state.roundIndex + 1 >= content.rounds.length ? next(state, { phase: "complete" }) : next(state, { roundIndex: state.roundIndex + 1, buzzed: undefined, awaitingChaser: undefined, settled: undefined, audienceAnswers: {} });
		return state;
	},
});
export const createRaceCondition = raceCondition;
