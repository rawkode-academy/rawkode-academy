import { expect, test } from "bun:test";
import { raceConditionSeed } from "../content/seed/race-condition";
import { createRaceCondition } from "./race-condition";
test("Race Condition gives the first buzzer the answer and moves deterministically", () => {
	const game = createRaceCondition(raceConditionSeed); const host = { id: "h", role: "host" as const }; const one = { id: "1", role: "team" as const, teamId: "one" }; const two = { id: "2", role: "team" as const, teamId: "two" };
	let state = game.handle(game.createState(raceConditionSeed), { type: "start" }, host, 0); state = game.handle(state, { type: "buzz" }, one, 10); state = game.handle(state, { type: "buzz" }, two, 11); state = game.handle(state, { type: "answer", answer: "A QUEUE" }, one, 12);
	expect(state.positions.one).toBe(2); expect(state.positions.two).toBeUndefined(); expect(state.scores.one).toBe(200);
	expect(state.settled).toBe(true);
	expect(game.handle(state, { type: "buzz" }, two, 13)).toBe(state);
	expect(game.handle(state, { type: "answer", answer: "queue" }, one, 14)).toBe(state);
});

test("Race Condition gives the chaser one response after a contestant misses", () => {
	const game = createRaceCondition(raceConditionSeed); const host = { id: "h", role: "host" as const }; const team = { id: "1", role: "team" as const, teamId: "one" };
	let state = game.handle(game.createState(raceConditionSeed), { type: "start" }, host, 0);
	expect(game.handle(state, { type: "chaser-answer", answer: "queue" }, host, 1)).toBe(state);
	state = game.handle(state, { type: "buzz" }, team, 2);
	state = game.handle(state, { type: "answer", answer: "stack" }, team, 3);
	expect(state).toMatchObject({ awaitingChaser: true, settled: false });
	state = game.handle(state, { type: "chaser-answer", answer: "queue" }, host, 4);
	expect(state).toMatchObject({ chaserPosition: 1, settled: true });
	state = game.handle(state, { type: "next-round" }, host, 5);
	expect(state.roundIndex).toBe(1);
});

test("Race Condition host can skip a no-buzz round", () => {
	const game = createRaceCondition(raceConditionSeed); const host = { id: "h", role: "host" as const };
	let state = game.handle(game.createState(raceConditionSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "next-round" }, host, 1);
	expect(state.roundIndex).toBe(1);
});
