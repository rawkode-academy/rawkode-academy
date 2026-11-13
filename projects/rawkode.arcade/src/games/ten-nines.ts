import { hasTeam, isHost, matchesAnswer, next, score, validation, type GameDefinition, type ValidationResult } from "./common";
interface TenAnswer { answer: string; aliases?: string[] }
interface TenRound { prompt: string; answers: TenAnswer[] }
export interface TenNinesContent { title: string; rounds: TenRound[] }
interface TenNinesState { phase: "lobby" | "open" | "revealed" | "complete"; roundIndex: number; found: string[]; claimedBy: Record<string, string>; scores: Record<string, number>; revealed?: boolean; audienceAnswers: Record<string, string> }
type TenNinesCommand = { type: "start" } | { type: "answer"; answer: string } | { type: "audience-answer"; answer: string } | { type: "reveal" } | { type: "next-round" };
export const createTenNines = (content: TenNinesContent): GameDefinition<TenNinesContent, TenNinesState, TenNinesCommand> => ({
	id: "ten-nines", name: "Ten Nines", createState: () => ({ phase: "lobby", roundIndex: 0, found: [], claimedBy: {}, scores: {}, audienceAnswers: {} }),
	validateContent: (value): ValidationResult => validation(...(value.rounds.length ? [] : ["at least one round is required"]), ...value.rounds.flatMap((round, index) => round.answers.length === 10 ? [] : [`round ${index + 1} needs exactly ten answers`])),
	redact: (state, role) => { if (role === "host") return state; const { audienceAnswers: _audienceAnswers, ...publicState } = state; return publicState; },
	handle: (state, command, actor) => {
		const round = content.rounds[state.roundIndex];
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "open" });
		if (command.type === "audience-answer" && actor.role === "audience" && state.phase === "open") return next(state, { audienceAnswers: { ...state.audienceAnswers, [actor.id]: command.answer } });
		if (command.type === "answer" && hasTeam(actor) && state.phase === "open" && round) { const found = round.answers.find((entry) => !state.found.includes(entry.answer) && matchesAnswer(command.answer, entry.answer, entry.aliases)); if (!found) return state; const answers = [...state.found, found.answer]; const finalRound = state.roundIndex + 1 >= content.rounds.length; return next(state, { found: answers, claimedBy: { ...state.claimedBy, [found.answer]: actor.teamId }, scores: score(state.scores, actor.teamId, 100), phase: answers.length === round.answers.length ? finalRound ? "complete" : "revealed" : state.phase, revealed: answers.length === round.answers.length ? true : state.revealed }); }
		if (command.type === "reveal" && isHost(actor) && state.phase === "open") return next(state, { phase: "revealed", revealed: true });
		if (command.type === "next-round" && isHost(actor) && (state.phase === "open" || state.phase === "revealed")) return state.roundIndex + 1 >= content.rounds.length ? next(state, { phase: "complete", revealed: true }) : next(state, { phase: "open", roundIndex: state.roundIndex + 1, found: [], claimedBy: {}, revealed: undefined, audienceAnswers: {} });
		return state;
	},
});
