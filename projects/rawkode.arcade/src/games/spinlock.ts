import { hasTeam, isHost, matchesAnswer, next, score, validation, type GameActor, type GameDefinition, type ValidationResult } from "./common";
export interface SpinRound { phrase: string; category: string; aliases?: string[] }
export interface SpinlockContent { title: string; wheel: number[]; rounds: SpinRound[] }
export interface SpinlockState { phase: "lobby" | "open" | "complete"; roundIndex: number; turn: number; wheelIndex: number; activeValue: number; letters: string[]; scores: Record<string, number>; solvedBy?: string; revealed?: boolean; audienceGuesses: Record<string, string> }
export type SpinlockCommand = { type: "start" } | { type: "spin" } | { type: "guess-letter"; letter: string } | { type: "solve"; answer: string } | { type: "audience-guess"; letter: string } | { type: "reveal" } | { type: "next-round" };
const chars = (phrase: string) => [...new Set(phrase.toUpperCase().match(/[A-Z0-9]/g) ?? [])];
export const spinlock = (content: SpinlockContent): GameDefinition<SpinlockContent, SpinlockState, SpinlockCommand> => ({
	id: "spinlock", name: "Spinlock", createState: () => ({ phase: "lobby", roundIndex: 0, turn: 0, wheelIndex: 0, activeValue: 0, letters: [], scores: {}, audienceGuesses: {} }),
	validateContent: (value): ValidationResult => validation(...(value.wheel.length ? [] : ["wheel requires values"]), ...(value.rounds.length ? [] : ["at least one round is required"]), ...value.rounds.filter((round) => !round.phrase.trim() || !round.category.trim()).map(() => "round needs phrase and category")),
	redact: (state, role) => { if (role === "host") return state; const { audienceGuesses: _audienceGuesses, ...publicState } = state; return publicState; },
	handle: (state, command, actor) => {
		const round = content.rounds[state.roundIndex];
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "open" });
		if (command.type === "audience-guess" && actor.role === "audience" && state.phase === "open" && !state.solvedBy && !state.revealed) return next(state, { audienceGuesses: { ...state.audienceGuesses, [actor.id]: command.letter } });
		if (command.type === "reveal" && isHost(actor) && state.phase === "open") return next(state, { revealed: true });
		if (command.type === "next-round" && isHost(actor) && state.phase === "open" && (state.solvedBy || state.revealed)) return state.roundIndex + 1 >= content.rounds.length ? next(state, { phase: "complete" }) : next(state, { roundIndex: state.roundIndex + 1, letters: [], solvedBy: undefined, revealed: undefined, activeValue: 0, audienceGuesses: {} });
		if (state.solvedBy || state.revealed) return state;
		if (!hasTeam(actor) || state.phase !== "open" || !round) return state;
		if (command.type === "spin") { const wheelIndex = (state.wheelIndex + 1) % content.wheel.length; return next(state, { wheelIndex, activeValue: content.wheel[wheelIndex] }); }
		if (command.type === "guess-letter") { const letter = command.letter.toUpperCase(); if (!/^[A-Z0-9]$/.test(letter) || state.letters.includes(letter)) return state; const hits = chars(round.phrase).includes(letter) ? (round.phrase.toUpperCase().split(letter).length - 1) : 0; return next(state, { letters: [...state.letters, letter], turn: hits ? state.turn : state.turn + 1, scores: hits ? score(state.scores, actor.teamId, hits * state.activeValue) : state.scores }); }
		if (command.type === "solve" && !state.solvedBy && matchesAnswer(command.answer, round.phrase, round.aliases)) return next(state, { solvedBy: actor.teamId, scores: score(state.scores, actor.teamId, 500), letters: chars(round.phrase) });
		return state;
	},
});
export const createSpinlock = spinlock;
