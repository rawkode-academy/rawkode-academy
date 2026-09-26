import { MAX_AUDIENCE_BINS_PER_SHARD } from "../domain/audience-choice";
import { hasTeam, isHost, matchesAnswer, next, score, validation, type GameActor, type GameDefinition, type ValidationResult } from "./common";
export interface NullAnswer { answer: string; aliases?: string[]; surveyResponses: number }
export interface NullRound { prompt: string; answers: NullAnswer[] }
export interface NullPointerContent { title: string; rounds: NullRound[] }
export interface NullPointerState { phase: "lobby" | "open" | "revealed" | "complete"; roundIndex: number; teamAnswers: Record<string, string>; audienceAnswers: Record<string, string>; scores: Record<string, number>; revealedAnswers?: { answer: string; points: number }[] }
export type NullPointerCommand = { type: "start" } | { type: "answer"; answer: string } | { type: "audience-answer"; answer: string } | { type: "reveal"; distribution?: Record<string, number> } | { type: "next-round" };
export const nullPointer = (content: NullPointerContent): GameDefinition<NullPointerContent, NullPointerState, NullPointerCommand> => ({
	id: "null-pointer", name: "Null Pointer", createState: () => ({ phase: "lobby", roundIndex: 0, teamAnswers: {}, audienceAnswers: {}, scores: {} }),
	validateContent: (value): ValidationResult => validation(...(value.rounds.length ? [] : ["at least one round is required"]), ...value.rounds.flatMap((round, index) => [ ...(round.prompt.trim() ? [] : [`round ${index + 1} needs a prompt`]), ...(round.answers.length <= MAX_AUDIENCE_BINS_PER_SHARD ? [] : [`round ${index + 1} exceeds ${MAX_AUDIENCE_BINS_PER_SHARD} answers`]), ...round.answers.filter((answer) => !answer.answer.trim() || answer.surveyResponses < 0).map(() => `round ${index + 1} has invalid answer`) ])),
	redact: (state, role) => { if (role === "host" || state.phase === "revealed" || state.phase === "complete") return state; const { teamAnswers: _teamAnswers, audienceAnswers: _audienceAnswers, revealedAnswers: _revealedAnswers, ...publicState } = state; return publicState; },
	handle: (state, command, actor) => {
		const round = content.rounds[state.roundIndex];
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "open" });
		if (command.type === "audience-answer" && actor.role === "audience" && state.phase === "open") return next(state, { audienceAnswers: { ...state.audienceAnswers, [actor.id]: command.answer } });
		if (command.type === "answer" && hasTeam(actor) && state.phase === "open" && !state.teamAnswers[actor.teamId]) return next(state, { teamAnswers: { ...state.teamAnswers, [actor.teamId]: command.answer } });
		if (command.type === "reveal" && isHost(actor) && state.phase === "open" && round) {
			const result = Object.entries(state.teamAnswers).map(([teamId, submitted]) => ({ teamId, entry: round.answers.find((answer) => matchesAnswer(submitted, answer.answer, answer.aliases)) }));
			const distribution = command.distribution ?? {};
			const audienceCount = (answer: NullAnswer): number => Object.entries(distribution).reduce((total, [submitted, count]) => matchesAnswer(submitted, answer.answer, answer.aliases) && Number.isFinite(count) && count > 0 ? total + count : total, 0);
			const counts = new Map(round.answers.map((answer) => [answer.answer, audienceCount(answer)]));
			const highestResponses = Math.max(0, ...counts.values());
			const scores = result.reduce((current, item) => item.entry ? score(current, item.teamId, highestResponses + 1 - (counts.get(item.entry.answer) ?? 0)) : current, state.scores);
			return next(state, { phase: "revealed", scores, revealedAnswers: round.answers.map((answer) => ({ answer: answer.answer, points: counts.get(answer.answer) ?? 0 })) });
		}
		if (command.type === "next-round" && isHost(actor) && state.phase === "revealed") return state.roundIndex + 1 >= content.rounds.length ? next(state, { phase: "complete" }) : next(state, { phase: "open", roundIndex: state.roundIndex + 1, teamAnswers: {}, audienceAnswers: {}, revealedAnswers: undefined });
		return state;
	},
});
export const createNullPointer = nullPointer;
