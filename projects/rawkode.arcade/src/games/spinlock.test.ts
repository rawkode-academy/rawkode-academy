import { expect, test } from "bun:test";
import { spinlockSeed } from "../content/seed/spinlock";
import { createSpinlock } from "./spinlock";
const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "byte-bandits" };
test("Spinlock uses deterministic wheel values and only host advances", () => {
	const game = createSpinlock(spinlockSeed); const rival = { id: "r", role: "team" as const, teamId: "rivals" }; let state = game.handle(game.createState(spinlockSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "spin" }, team, 1); state = game.handle(state, { type: "guess-letter", letter: "E" }, team, 2);
	expect(state.scores[team.teamId]).toBe(450); state = game.handle(state, { type: "solve", answer: "eventual consistency" }, team, 3);
	state = game.handle(state, { type: "solve", answer: "eventual consistency" }, rival, 4); expect(state.solvedBy).toBe(team.teamId); expect(state.scores.rivals).toBeUndefined();
	expect(game.handle(state, { type: "next-round" }, team, 5)).toBe(state); expect(game.handle(state, { type: "next-round" }, host, 5).roundIndex).toBe(1);
});
