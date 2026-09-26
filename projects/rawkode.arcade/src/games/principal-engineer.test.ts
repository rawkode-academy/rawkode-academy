import { expect, test } from "bun:test";
import { principalEngineerSeed } from "../content/seed/principal-engineer";
import { createPrincipalEngineer } from "./principal-engineer";
test("Principal Engineer scores a correct answer once and supports audience voting", () => {
	const game = createPrincipalEngineer(principalEngineerSeed); const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "ops" };
	let state = game.handle(game.createState(principalEngineerSeed), { type: "start" }, host, 0); state = game.handle(state, { type: "audience-vote", choice: 2 }, { id: "a", role: "audience" }, 1); state = game.handle(state, { type: "answer", choice: 2 }, team, 2); state = game.handle(state, { type: "answer", choice: 2 }, team, 3);
	expect(state.scores.ops).toBe(100); expect(state.audienceVotes.a).toBe(2); expect(game.redact(state, "team")).not.toHaveProperty("audienceVotes");
});

test("Principal Engineer cannot score after the host reveals the correct answer", () => {
	const game = createPrincipalEngineer(principalEngineerSeed); const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "ops" };
	let state = game.handle(game.createState(principalEngineerSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "reveal" }, host, 1);
	expect(game.redact(state, "team")).toHaveProperty("revealed", true);
	expect(game.handle(state, { type: "answer", choice: 2 }, team, 2)).toBe(state);
});

test("Principal Engineer persists a private random 50:50 survivor without encoding the answer position", () => {
	const host = { id: "h", role: "host" as const };
	const team = { id: "t", role: "team" as const, teamId: "ops" };
	const survivors = (correct: number, randomIndex: number) => {
		const content = { title: "Security", questions: [{ prompt: "Pick", choices: ["A", "B", "C", "D"], correct, prize: 100 }] };
		const game = createPrincipalEngineer(content, () => randomIndex);
		let state = game.handle(game.createState(content), { type: "start" }, host, 0);
		state = game.handle(state, { type: "use-lifeline", lifeline: "fifty-fifty" }, team, 1);
		expect(state.fiftyFiftyIncorrect).not.toBe(correct);
		expect(game.redact(state, "team")).not.toHaveProperty("fiftyFiftyIncorrect");
		expect(game.redact(state, "team")).not.toHaveProperty("fiftyFiftyDraws");
		return [correct, state.fiftyFiftyIncorrect].sort();
	};
	const possibleCorrectByVisiblePair = new Map<string, Set<number>>();
	for (let correct = 0; correct < 4; correct += 1) for (let randomIndex = 0; randomIndex < 3; randomIndex += 1) {
		const pair = survivors(correct, randomIndex);
		expect(pair).toHaveLength(2);
		const key = pair.join(",");
		const possible = possibleCorrectByVisiblePair.get(key) ?? new Set<number>();
		possible.add(correct);
		possibleCorrectByVisiblePair.set(key, possible);
	}
	expect(possibleCorrectByVisiblePair).toHaveProperty("size", 6);
	expect([...possibleCorrectByVisiblePair.values()].every((possible) => possible.size === 2)).toBe(true);
});

test("Principal Engineer shares one 50:50 survivor across teams for a question", () => {
	let randomCalls = 0;
	const game = createPrincipalEngineer(principalEngineerSeed, () => randomCalls++);
	const host = { id: "host", role: "host" as const };
	let state = game.handle(game.createState(principalEngineerSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "use-lifeline", lifeline: "fifty-fifty" }, { id: "red", role: "team", teamId: "team-red" }, 1);
	const survivor = state.fiftyFiftyIncorrect;
	state = game.handle(state, { type: "use-lifeline", lifeline: "fifty-fifty" }, { id: "blue", role: "team", teamId: "team-blue" }, 2);
	expect(state.fiftyFiftyIncorrect).toBe(survivor);
	expect(randomCalls).toBe(principalEngineerSeed.questions.length);
});

test("Principal Engineer replays the same initialized private draw", () => {
	const host = { id: "host", role: "host" as const }; const team = { id: "team", role: "team" as const, teamId: "team-red" };
	const game = createPrincipalEngineer(principalEngineerSeed, () => 1);
	const initialized = game.createState(principalEngineerSeed);
	const play = () => game.handle(game.handle(initialized, { type: "start" }, host, 0), { type: "use-lifeline", lifeline: "fifty-fifty" }, team, 1).fiftyFiftyIncorrect;
	expect(play()).toBe(play());
});

test("Principal Engineer generates independent private draws for distinct initialized games", () => {
	let nextDraw = 0;
	const content = { title: "Security", questions: [{ prompt: "Pick", choices: ["A", "B", "C", "D"], correct: 0, prize: 100 }] };
	const game = createPrincipalEngineer(content, () => nextDraw++);
	const first = game.createState(content);
	const second = game.createState(content);
	expect(first.fiftyFiftyDraws).toEqual([0]);
	expect(second.fiftyFiftyDraws).toEqual([1]);
});
