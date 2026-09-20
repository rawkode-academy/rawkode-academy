import { mergeConflictSeed, nullPointerSeed, principalEngineerSeed, raceConditionSeed, spinlockSeed, tenNinesSeed } from "../content/seed";
import { createMergeConflict, createNullPointer, createPrincipalEngineer, createRaceCondition, createSpinlock, createTenNines, type ActorRole, type GameActor, type ValidationResult } from "../games";
import { matchesAnswer } from "../games/common";
import { normalizeAudienceChoice } from "./audience-choice";
import { applyCoreCommand, type EngineResult, type GameState } from "./engine";
import type { CommandEnvelope, Principal, Role } from "./protocol";

export interface GameDefinition {
	key: "merge-conflict" | "spinlock" | "principal-engineer" | "race-condition" | "ten-nines" | "null-pointer";
	title: string;
	description: string;
}
type GameKey = GameDefinition["key"];
type RuntimeReducer = { createState: (content: unknown) => unknown; validateContent: (content: unknown) => ValidationResult; redact: (state: unknown, role: ActorRole) => unknown; handle: (state: unknown, command: unknown, actor: GameActor, now: number) => unknown };
type Runtime = GameDefinition & { content: unknown; reducer: RuntimeReducer; prompt: (state: Record<string, unknown>) => GameState["activePrompt"] };
type Payload = Record<string, unknown>;
type PublishedSnapshot = { revisionId: string; checksum: string; manifest: Record<string, unknown>; questions: Array<{ id: string; ordinal: number; kind: string; prompt: string; options: unknown; answer: unknown }> };
const asRuntime = (value: unknown): RuntimeReducer => value as RuntimeReducer;
const runtimes: Record<GameKey, Runtime> = {
	"merge-conflict": { key: "merge-conflict", title: "Merge Conflict", description: "Developer survey showdown", content: mergeConflictSeed, reducer: asRuntime(createMergeConflict(mergeConflictSeed)), prompt: (state) => { const round = mergeConflictSeed.rounds[Number(state.roundIndex)]; return round ? { id: `merge-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } },
	spinlock: { key: "spinlock", title: "Spinlock", description: "Solve the technical phrase", content: spinlockSeed, reducer: asRuntime(createSpinlock(spinlockSeed)), prompt: (state) => { const round = spinlockSeed.rounds[Number(state.roundIndex)]; return round ? { id: `spin-${state.roundIndex}`, prompt: round.category, choices: [] } : undefined; } },
	"principal-engineer": { key: "principal-engineer", title: "Who Wants to Be a Principal Engineer?", description: "Climb the engineering ladder", content: principalEngineerSeed, reducer: asRuntime(createPrincipalEngineer(principalEngineerSeed)), prompt: (state) => { const question = principalEngineerSeed.questions[Number(state.questionIndex)]; return question ? { id: `principal-${state.questionIndex}`, prompt: question.prompt, choices: question.choices.map((label, index) => ({ id: String(index), label })) } : undefined; } },
	"race-condition": { key: "race-condition", title: "Race Condition", description: "Race the chaser", content: raceConditionSeed, reducer: asRuntime(createRaceCondition(raceConditionSeed)), prompt: (state) => { const round = raceConditionSeed.rounds[Number(state.roundIndex)]; return round ? { id: `race-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } },
	"ten-nines": { key: "ten-nines", title: "Ten Nines", description: "Complete the developer list", content: tenNinesSeed, reducer: asRuntime(createTenNines(tenNinesSeed)), prompt: (state) => { const round = tenNinesSeed.rounds[Number(state.roundIndex)]; return round ? { id: `nines-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } },
	"null-pointer": { key: "null-pointer", title: "Null Pointer", description: "The rarest correct answer wins", content: nullPointerSeed, reducer: asRuntime(createNullPointer(nullPointerSeed)), prompt: (state) => { const round = nullPointerSeed.rounds[Number(state.roundIndex)]; return round ? { id: `null-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } },
};
for (const runtime of Object.values(runtimes)) { const validation = runtime.reducer.validateContent(runtime.content); if (!validation.valid) throw new Error(`Invalid ${runtime.key} seed: ${validation.errors.join(", ")}`); }
export const games: Record<GameKey, GameDefinition> = Object.fromEntries(Object.entries(runtimes).map(([key, runtime]) => [key, { key: runtime.key, title: runtime.title, description: runtime.description }])) as Record<GameKey, GameDefinition>;
function immutable<T>(value: T): T { if (!value || typeof value !== "object") return value; Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) immutable(child); return value; }
function asRecord(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function asItems(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }
function answerItems(value: unknown, options: unknown): unknown[] { const record = asRecord(value); const optionRecord = asRecord(options); return asItems(record?.answers ?? optionRecord?.answers ?? options ?? value); }
function text(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function title(snapshot: PublishedSnapshot, fallback: string): string { return text(snapshot.manifest.title) || fallback; }
function mappedContent(key: GameKey, snapshot: PublishedSnapshot, fallback: unknown): unknown {
	const direct = snapshot.manifest.gameContent ?? snapshot.manifest.runtimeContent ?? snapshot.manifest.content;
	if (direct !== undefined) return structuredClone(direct);
	const questions = [...snapshot.questions].sort((left, right) => left.ordinal - right.ordinal);
	if (key === "merge-conflict") return { title: title(snapshot, "Merge Conflict"), rounds: questions.map((question) => ({ prompt: question.prompt, answers: answerItems(question.answer, question.options).map((item) => { const entry = asRecord(item); return { answer: text(entry?.answer ?? item), aliases: Array.isArray(entry?.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === "string") : [], points: Number(entry?.points ?? 100) }; }) })) };
	if (key === "spinlock") return { title: title(snapshot, "Spinlock"), wheel: asItems(snapshot.manifest.wheel).map(Number).filter(Number.isFinite).length ? asItems(snapshot.manifest.wheel).map(Number).filter(Number.isFinite) : [100, 150, 200, 250], rounds: questions.map((question) => { const entry = asRecord(question.answer); const options = asRecord(question.options); return { phrase: text(entry?.phrase ?? entry?.answer ?? question.answer), category: text(options?.category ?? entry?.category ?? question.kind) || "Developer phrase", aliases: Array.isArray(entry?.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === "string") : [] }; }) };
	if (key === "principal-engineer") return { title: title(snapshot, "Who Wants to Be a Principal Engineer?"), questions: questions.map((question) => { const entry = asRecord(question.answer); const choices = asItems(asRecord(question.options)?.choices ?? question.options).map((option) => text(asRecord(option)?.label ?? option)); const correctValue = entry?.correct ?? question.answer; const correct = typeof correctValue === "number" ? correctValue : choices.findIndex((option) => option === text(correctValue)); return { prompt: question.prompt, choices, correct, prize: Number(entry?.prize ?? snapshot.manifest.prize ?? 100) }; }) };
	if (key === "race-condition") return { title: title(snapshot, "Race Condition"), finish: Number(snapshot.manifest.finish ?? 5), rounds: questions.map((question) => { const entry = asRecord(question.answer); return { prompt: question.prompt, answer: text(entry?.answer ?? question.answer), aliases: Array.isArray(entry?.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === "string") : [], teamSteps: Number(entry?.teamSteps ?? 1), chaserSteps: Number(entry?.chaserSteps ?? 1) }; }) };
	if (key === "ten-nines") return { title: title(snapshot, "Ten Nines"), rounds: questions.map((question) => ({ prompt: question.prompt, answers: answerItems(question.answer, question.options).map((item) => { const entry = asRecord(item); return { answer: text(entry?.answer ?? item), aliases: Array.isArray(entry?.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === "string") : [] }; }) })) };
	return { title: title(snapshot, "Null Pointer"), rounds: questions.map((question) => ({ prompt: question.prompt, answers: answerItems(question.answer, question.options).map((item) => { const entry = asRecord(item); return { answer: text(entry?.answer ?? item), aliases: Array.isArray(entry?.aliases) ? entry.aliases.filter((alias): alias is string => typeof alias === "string") : [], surveyResponses: Number(entry?.surveyResponses ?? entry?.points ?? 0) }; }) })) };
}
function bindRuntime(template: Runtime, content: unknown): Runtime {
	const immutableContent = immutable(structuredClone(content));
	if (template.key === "merge-conflict") return { ...template, content: immutableContent, reducer: asRuntime(createMergeConflict(immutableContent as Parameters<typeof createMergeConflict>[0])), prompt: (state) => { const round = (immutableContent as typeof mergeConflictSeed).rounds[Number(state.roundIndex)]; return round ? { id: `merge-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } };
	if (template.key === "spinlock") return { ...template, content: immutableContent, reducer: asRuntime(createSpinlock(immutableContent as Parameters<typeof createSpinlock>[0])), prompt: (state) => { const round = (immutableContent as typeof spinlockSeed).rounds[Number(state.roundIndex)]; return round ? { id: `spin-${state.roundIndex}`, prompt: round.category, choices: [] } : undefined; } };
	if (template.key === "principal-engineer") return { ...template, content: immutableContent, reducer: asRuntime(createPrincipalEngineer(immutableContent as Parameters<typeof createPrincipalEngineer>[0])), prompt: (state) => { const question = (immutableContent as typeof principalEngineerSeed).questions[Number(state.questionIndex)]; return question ? { id: `principal-${state.questionIndex}`, prompt: question.prompt, choices: question.choices.map((label, index) => ({ id: String(index), label })) } : undefined; } };
	if (template.key === "race-condition") return { ...template, content: immutableContent, reducer: asRuntime(createRaceCondition(immutableContent as Parameters<typeof createRaceCondition>[0])), prompt: (state) => { const round = (immutableContent as typeof raceConditionSeed).rounds[Number(state.roundIndex)]; return round ? { id: `race-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } };
	if (template.key === "ten-nines") return { ...template, content: immutableContent, reducer: asRuntime(createTenNines(immutableContent as Parameters<typeof createTenNines>[0])), prompt: (state) => { const round = (immutableContent as typeof tenNinesSeed).rounds[Number(state.roundIndex)]; return round ? { id: `nines-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } };
	return { ...template, content: immutableContent, reducer: asRuntime(createNullPointer(immutableContent as Parameters<typeof createNullPointer>[0])), prompt: (state) => { const round = (immutableContent as typeof nullPointerSeed).rounds[Number(state.roundIndex)]; return round ? { id: `null-${state.roundIndex}`, prompt: round.prompt, choices: [] } : undefined; } };
}
function snapshotFor(state: GameState): PublishedSnapshot | undefined { return (state.private as GameState["private"] & { contentSnapshot?: PublishedSnapshot }).contentSnapshot; }
function runtimeFor(gameKey: string, state?: GameState): Runtime | undefined { const template = runtimes[gameKey as GameKey]; if (!template) return undefined; const snapshot = state && snapshotFor(state); if (!snapshot) return template; const runtime = bindRuntime(template, mappedContent(template.key, snapshot, template.content)); const validation = runtime.reducer.validateContent(runtime.content); if (!validation.valid) throw new Error("BAD_COMMAND"); return runtime; }
/** Resolves an audience response to the pinned Null Pointer answer without exposing the answer set. */
export function canonicalAudienceChoice(state: GameState, value: string): string | undefined {
	const runtime = runtimeFor(state.gameKey, state);
	if (!runtime || runtime.key !== "null-pointer") return undefined;
	const persisted = runtimeState(state, runtime) as { roundIndex?: number };
	const round = (runtime.content as typeof nullPointerSeed).rounds[Number(persisted.roundIndex ?? 0)];
	const normalized = normalizeAudienceChoice(value);
	const answer = round?.answers.find((candidate) => matchesAnswer(normalized, candidate.answer, candidate.aliases));
	return answer ? normalizeAudienceChoice(answer.answer) : undefined;
}
/** Validates a published content snapshot against the exact reducer it will bind in a room. */
export function validatePublishedContent(gameKey: string, snapshot: PublishedSnapshot): ValidationResult {
	const template = runtimes[gameKey as GameKey];
	if (!template) return { valid: false, errors: ["unknown game key"] };
	const runtime = bindRuntime(template, mappedContent(template.key, snapshot, template.content));
	return runtime.reducer.validateContent(runtime.content);
}
function runtimeState(state: GameState, runtime: Runtime): unknown { const persisted = state.private.runtime; return persisted?.gameKey === runtime.key ? immutable(structuredClone(persisted.state)) : immutable(runtime.reducer.createState(runtime.content)); }
function actorFor(principal: Principal, command: CommandEnvelope): GameActor {
	const payload = (command.payload && typeof command.payload === "object" ? command.payload : {}) as Payload;
	const delegatedTeam = typeof payload.teamId === "string" ? payload.teamId : undefined;
	const hostTeamCommand = ["spinlock.spin", "spinlock.guess-letter", "principal.lifeline"].includes(command.type);
	if ((principal.role === "host" || principal.role === "producer") && hostTeamCommand && delegatedTeam) return { id: principal.id, role: "team", teamId: delegatedTeam };
	if (principal.role === "host" || principal.role === "producer") return { id: principal.id, role: "host" };
	if (principal.role === "player") { if (!principal.teamId) throw new Error("BAD_COMMAND"); return { id: principal.id, role: "team", teamId: principal.teamId }; }
	if (principal.role === "audience") return { id: principal.id, role: "audience" };
	throw new Error("FORBIDDEN");
}
function answer(payload: Payload): string { return String(payload.answer ?? payload.letter ?? payload.choice ?? payload.choiceId ?? "").trim(); }
function choice(payload: Payload): number { const value = Number(payload.choice ?? payload.choiceId ?? payload.answer); if (!Number.isInteger(value)) throw new Error("BAD_COMMAND"); return value; }
function mapCommand(key: GameKey, state: Record<string, unknown>, command: CommandEnvelope, principal: Principal): unknown | undefined {
	const payload = (command.payload && typeof command.payload === "object" ? command.payload : {}) as Payload;
	if (command.type === "room.start") return { type: "start" };
	if (command.type === "buzzer.press" && key === "race-condition") return { type: "buzz" };
	if (command.type === "answer.submit") return principal.role === "audience" ? key === "principal-engineer" ? { type: "audience-vote", choice: choice(payload) } : key === "spinlock" ? { type: "audience-guess", letter: answer(payload) } : { type: "audience-answer", answer: answer(payload) } : key === "principal-engineer" ? { type: "answer", choice: choice(payload) } : key === "spinlock" ? { type: "solve", answer: answer(payload) } : { type: "answer", answer: answer(payload) };
	if (command.type === "audience.vote") return key === "principal-engineer" ? { type: "audience-vote", choice: choice(payload) } : key === "spinlock" ? { type: "audience-guess", letter: answer(payload) } : { type: "audience-answer", answer: answer(payload) };
	if (command.type === "spinlock.spin" && key === "spinlock") return { type: "spin" };
	if (command.type === "spinlock.guess-letter" && key === "spinlock") return { type: "guess-letter", letter: answer(payload) };
	if (command.type === "principal.lifeline" && key === "principal-engineer") { const lifeline = payload.lifeline; if (lifeline !== "fifty-fifty" && lifeline !== "ask-audience") throw new Error("BAD_COMMAND"); return { type: "use-lifeline", lifeline }; }
	if (command.type === "race.chaser-answer" && key === "race-condition") return { type: "chaser-answer", answer: answer(payload) };
	if (command.type === "prompt.reveal" && key !== "race-condition") return { type: "reveal" };
	if (command.type === "phase.advance") { if (key === "principal-engineer") return { type: "next-question" }; if (key === "null-pointer" || key === "ten-nines") return state.revealed === true || state.phase === "revealed" ? { type: "next-round" } : { type: "reveal" }; return { type: "next-round" }; }
	return undefined;
}
function project(state: GameState, runtime: Runtime, reducerState: unknown): GameState {
	const runtimeView = runtime.reducer.redact(reducerState, "audience") as Record<string, unknown>; const view = runtimeView && typeof runtimeView === "object" ? runtimeView : {}; const next = structuredClone(state); next.private.runtime = { gameKey: runtime.key, state: immutable(structuredClone(reducerState)) };
	const prior = state.private.runtime?.state as Record<string, unknown> | undefined;
	const currentRound = Number(view.roundIndex ?? view.questionIndex ?? 0);
	const priorRound = Number(prior?.roundIndex ?? prior?.questionIndex ?? -1);
	if (currentRound > priorRound) { next.audience = { totals: {}, reactions: {} }; next.audienceDistribution = {}; next.private.audienceShards = {}; next.private.audienceCanonicalShards = {}; next.private.audienceCanonicalDistribution = {}; next.private.audienceReactionShards = {}; }
	const scores = view.scores && typeof view.scores === "object" ? view.scores as Record<string, number> : {}; for (const [teamId] of Object.entries(scores)) next.teams[teamId] ??= { id: teamId, name: teamId, score: 0, memberIds: [] }; for (const team of Object.values(next.teams)) if (Number.isSafeInteger(scores[team.id])) team.score = scores[team.id];
	const phase = String(view.phase ?? "lobby"); next.status = phase === "complete" ? "complete" : phase === "lobby" ? "lobby" : "live"; next.phase = phase === "question" ? "question" : phase === "revealed" ? "reveal" : phase === "complete" ? "complete" : phase === "lobby" ? "setup" : "round"; next.activePrompt = runtime.prompt(view);
	const roundIndex = Number(view.roundIndex ?? view.questionIndex ?? 0); const runtimeContent = runtime.content as { rounds?: unknown[]; questions?: unknown[] }; next.round = { index: Number.isSafeInteger(roundIndex) && roundIndex >= 0 ? roundIndex : 0, total: runtimeContent.questions?.length ?? runtimeContent.rounds?.length ?? 0, id: next.activePrompt?.id, phase: next.phase };
	if (runtime.key === "spinlock") { const letters = Array.isArray(view.letters) ? view.letters.filter((letter): letter is string => typeof letter === "string") : []; const solved = typeof view.solvedBy === "string"; const phrase = (runtime.content as typeof spinlockSeed).rounds[Number(view.roundIndex)]?.phrase ?? ""; const board = [...phrase].map((character) => /[a-z0-9]/i.test(character) ? solved || letters.includes(character.toUpperCase()) ? character.toUpperCase() : "▢" : character).join(""); next.spinlock = { board, letters, activeValue: Number(view.activeValue) || 0, turn: Number(view.turn) || 0, solved }; }
	else next.spinlock = undefined;
	if (runtime.key === "principal-engineer") {
		const raw = reducerState as { questionIndex?: number; activeLifelines?: Record<string, string[]>; audienceVotes?: Record<string, number>; fiftyFiftyIncorrect?: number };
		const activeLifelines = Object.values(raw.activeLifelines ?? {}).flat();
		const usedLifelines = Object.values((reducerState as { lifelines?: Record<string, string[]> }).lifelines ?? {}).flat();
		const fiftyFiftyActive = activeLifelines.includes("fifty-fifty");
		const askAudienceActive = activeLifelines.includes("ask-audience");
		const fiftyFiftyUsed = usedLifelines.includes("fifty-fifty");
		const askAudienceUsed = usedLifelines.includes("ask-audience");
		const question = (runtime.content as typeof principalEngineerSeed).questions[Number(raw.questionIndex ?? 0)];
		const keptChoiceIds = question && fiftyFiftyActive && Number.isInteger(raw.fiftyFiftyIncorrect) ? new Set([String(question.correct), String(raw.fiftyFiftyIncorrect)]) : undefined;
		const allChoices = next.activePrompt?.choices ?? [];
		const eliminatedChoiceIds = keptChoiceIds ? allChoices.filter((choice) => !keptChoiceIds.has(choice.id)).map((choice) => choice.id) : [];
		if (keptChoiceIds && next.activePrompt) next.activePrompt.choices = allChoices.filter((choice) => keptChoiceIds.has(choice.id));
		const audienceAdvice: Record<string, number> = askAudienceActive ? structuredClone(state.audience.totals) : {};
		if (askAudienceActive) for (const choice of Object.values(raw.audienceVotes ?? {})) audienceAdvice[String(choice)] = (audienceAdvice[String(choice)] ?? 0) + 1;
		next.principalEngineer = { fiftyFiftyUsed, askAudienceUsed, fiftyFiftyActive, askAudienceActive, eliminatedChoiceIds, audienceAdvice };
	} else next.principalEngineer = undefined;
	if (Array.isArray(view.revealed)) next.revealedAnswer = view.revealed.join(" · "); else if (Array.isArray(view.revealedAnswers)) next.revealedAnswer = (view.revealedAnswers as Array<{ answer?: string }>).map((entry) => entry.answer).filter(Boolean).join(" · "); else if (runtime.key === "spinlock" && typeof view.solvedBy === "string") next.revealedAnswer = view.revealed === true ? (runtime.content as typeof spinlockSeed).rounds[Number(view.roundIndex)]?.phrase : "Solved"; else if (runtime.key === "principal-engineer" && view.revealed === true) { const question = (runtime.content as typeof principalEngineerSeed).questions[Number(view.questionIndex)]; next.revealedAnswer = question?.choices[question.correct]; } else if (runtime.key === "ten-nines" && view.revealed === true && Array.isArray(view.found)) next.revealedAnswer = view.found.join(" · "); else next.revealedAnswer = undefined;
	return next;
}
/** Applies each reducer's role-specific redaction for snapshot/replay adapters. */
export function redactRuntime(state: GameState, role: Role): unknown { const runtime = runtimeFor(state.gameKey, state); const persisted = state.private.runtime; if (!runtime || persisted?.gameKey !== runtime.key) return undefined; const actorRole: ActorRole = role === "host" || role === "producer" ? "host" : role === "player" ? "team" : "audience"; return runtime.reducer.redact(persisted.state, actorRole); }
function applyCoreWithRuntimeScore(state: GameState, command: CommandEnvelope, principal: Principal, now: number): EngineResult {
	const result = applyCoreCommand(state, command, principal, now);
	if ((command.type === "score.add" || command.type === "score.correct") && result.state.private.runtime) {
		const payload = asRecord(command.payload) ?? {}; const teamId = text(payload.teamId) || "team-red"; const correctedScore = result.state.teams[teamId]?.score;
		const reducerState = asRecord(result.state.private.runtime.state); const scores = asRecord(reducerState?.scores);
		if (Number.isSafeInteger(correctedScore) && reducerState && scores) result.state.private.runtime = { ...result.state.private.runtime, state: immutable({ ...reducerState, scores: { ...scores, [teamId]: correctedScore } }) };
	}
	return result;
}
export function applyCommand(state: GameState, command: CommandEnvelope, principal: Principal, now = Date.now()): EngineResult { const runtime = runtimeFor(state.gameKey, state); if (!runtime) return applyCoreWithRuntimeScore(state, command, principal, now); if (command.type === "answer.submit" && state.activePrompt?.closesAt && now > Date.parse(state.activePrompt.closesAt)) throw new Error("DEADLINE_EXPIRED"); const isGameCommand = command.type === "room.start" || command.type === "answer.submit" || command.type === "audience.vote" || command.type === "buzzer.press" || command.type === "prompt.reveal" || command.type === "phase.advance" || command.type === "spinlock.spin" || command.type === "spinlock.guess-letter" || command.type === "principal.lifeline" || command.type === "race.chaser-answer"; if (isGameCommand && state.status !== "lobby" && state.status !== "live") throw new Error("BAD_COMMAND"); if (!state.private.runtime && !isGameCommand) return applyCoreWithRuntimeScore(state, command, principal, now); const current = runtimeState(state, runtime); const mapped = mapCommand(runtime.key, current as Record<string, unknown>, command, principal); if (!mapped) return applyCoreWithRuntimeScore(state, command, principal, now); const nullReveal = runtime.key === "null-pointer" && (mapped as { type?: string }).type === "reveal"; if (nullReveal && !state.audience.frozen) throw new Error("BAD_COMMAND"); const authoritativeCommand = nullReveal ? { type: "reveal", distribution: state.private.audienceCanonicalDistribution ?? state.audienceDistribution } : mapped; const nextReducerState = immutable(runtime.reducer.handle(current, authoritativeCommand, actorFor(principal, command), now)); if (nextReducerState === current) throw new Error(command.type === "buzzer.press" ? "CONFLICT" : "BAD_COMMAND"); const next = project(state, runtime, nextReducerState); if (command.type === "buzzer.press") next.buzzerWinner = principal.displayName ?? next.players[principal.id]?.displayName ?? principal.id; next.version += 1; return { state: next, event: command.type, payload: command.payload }; }
