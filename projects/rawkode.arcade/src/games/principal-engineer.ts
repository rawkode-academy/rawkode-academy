import { hasTeam, isHost, next, score, validation, type GameActor, type GameDefinition, type ValidationResult } from "./common";
export interface PrincipalQuestion { prompt: string; choices: string[]; correct: number; prize: number }
export interface PrincipalEngineerContent { title: string; questions: PrincipalQuestion[] }
export interface PrincipalEngineerState { phase: "lobby" | "question" | "complete"; questionIndex: number; scores: Record<string, number>; answeredTeams: string[]; audienceVotes: Record<string, number>; revealed?: boolean; lifelines: Record<string, string[]>; activeLifelines: Record<string, string[]>; /** Private uniformly-random index into this question's incorrect choices. */ fiftyFiftyDraws: number[]; fiftyFiftyIncorrect?: number }
export type PrincipalEngineerCommand = { type: "start" } | { type: "answer"; choice: number } | { type: "audience-vote"; choice: number } | { type: "use-lifeline"; lifeline: "fifty-fifty" | "ask-audience" } | { type: "reveal" } | { type: "next-question" };
const cryptoIndex = (upperBound: number): number => {
	if (!Number.isInteger(upperBound) || upperBound < 1) return 0;
	const range = 0x1_0000_0000;
	const limit = Math.floor(range / upperBound) * upperBound;
	const words = new Uint32Array(1);
	let value = limit;
	while (value >= limit) { crypto.getRandomValues(words); value = words[0]!; }
	return value % upperBound;
};
const lifelineDraws = (content: PrincipalEngineerContent, drawIndex?: (upperBound: number, questionIndex: number) => number): number[] =>
	content.questions.map((question, questionIndex) => {
		const upperBound = Math.max(1, question.choices.length - 1);
		const candidate = drawIndex?.(upperBound, questionIndex);
		return Number.isInteger(candidate) && candidate! >= 0 && candidate! < upperBound ? candidate! : cryptoIndex(upperBound);
	});
export const principalEngineer = (content: PrincipalEngineerContent, randomIndex?: (upperBound: number, questionIndex: number) => number): GameDefinition<PrincipalEngineerContent, PrincipalEngineerState, PrincipalEngineerCommand> => ({
	id: "principal-engineer", name: "Who Wants to Be a Principal Engineer?", createState: () => ({ phase: "lobby", questionIndex: 0, scores: {}, answeredTeams: [], audienceVotes: {}, lifelines: {}, activeLifelines: {}, fiftyFiftyDraws: lifelineDraws(content, randomIndex) }),
	validateContent: (value): ValidationResult => validation(...(value.questions.length ? [] : ["at least one question is required"]), ...value.questions.flatMap((question, index) => [ ...(question.choices.length === 4 ? [] : [`question ${index + 1} needs four choices`]), ...(question.correct >= 0 && question.correct < question.choices.length ? [] : [`question ${index + 1} has invalid correct index`]), ...(question.prize > 0 ? [] : [`question ${index + 1} needs a prize`]) ])),
	redact: (state, role) => { if (role === "host") return state; const { audienceVotes: _audienceVotes, fiftyFiftyDraws: _fiftyFiftyDraws, fiftyFiftyIncorrect: _fiftyFiftyIncorrect, ...publicState } = state; return publicState; },
	handle: (state, command, actor) => {
		const question = content.questions[state.questionIndex];
		if (command.type === "start" && isHost(actor) && state.phase === "lobby") return next(state, { phase: "question" });
		if (command.type === "audience-vote" && actor.role === "audience" && state.phase === "question" && !state.revealed && question && command.choice >= 0 && command.choice < question.choices.length) return next(state, { audienceVotes: { ...state.audienceVotes, [actor.id]: command.choice } });
		if (command.type === "use-lifeline" && hasTeam(actor) && state.phase === "question" && !state.revealed) { const used = state.lifelines[actor.teamId] ?? []; if (used.includes(command.lifeline)) return state; const incorrectChoices = question?.choices.map((_choice, index) => index).filter((index) => index !== question.correct) ?? []; const needsPair = command.lifeline === "fifty-fifty" && state.fiftyFiftyIncorrect === undefined && incorrectChoices.length; const draw = state.fiftyFiftyDraws[state.questionIndex] ?? 0; const fiftyFiftyIncorrect = needsPair ? incorrectChoices[draw] ?? incorrectChoices[0] : state.fiftyFiftyIncorrect; return next(state, { lifelines: { ...state.lifelines, [actor.teamId]: [...used, command.lifeline] }, activeLifelines: { ...(state.activeLifelines ?? {}), [actor.teamId]: [...(state.activeLifelines?.[actor.teamId] ?? []), command.lifeline] }, fiftyFiftyIncorrect }); }
		if (command.type === "answer" && hasTeam(actor) && state.phase === "question" && !state.revealed && question && !state.answeredTeams.includes(actor.teamId) && command.choice >= 0 && command.choice < question.choices.length) { const fiftyFiftyActive = Object.values(state.activeLifelines ?? {}).some((lifelines) => lifelines.includes("fifty-fifty")); if (fiftyFiftyActive && command.choice !== question.correct && command.choice !== state.fiftyFiftyIncorrect) return state; return next(state, { answeredTeams: [...state.answeredTeams, actor.teamId], scores: command.choice === question.correct ? score(state.scores, actor.teamId, question.prize) : state.scores }); }
		if (command.type === "reveal" && isHost(actor) && state.phase === "question" && !state.revealed) return next(state, { revealed: true });
		if (command.type === "next-question" && isHost(actor) && state.phase === "question") return state.questionIndex + 1 >= content.questions.length ? next(state, { phase: "complete", revealed: true }) : next(state, { questionIndex: state.questionIndex + 1, answeredTeams: [], audienceVotes: {}, activeLifelines: {}, fiftyFiftyIncorrect: undefined, revealed: undefined });
		return state;
	},
});
export const createPrincipalEngineer = principalEngineer;
