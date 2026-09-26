import { expect, test } from "bun:test";
import { tenNinesSeed } from "../content/seed/ten-nines";
import { createTenNines } from "./ten-nines";
test("Ten Nines accepts normalized aliases once and tracks claims", () => {
	const game = createTenNines(tenNinesSeed); const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "devs" }; let state = game.handle(game.createState(tenNinesSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "answer", answer: "Not Found" }, team, 1); state = game.handle(state, { type: "answer", answer: "404" }, team, 2);
	expect(state.found).toEqual(["404"]); expect(state.scores.devs).toBe(100);
});

test("Ten Nines settles a completed nonfinal list before advancing", () => {
	const game = createTenNines(tenNinesSeed); const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "devs" };
	let state = game.handle(game.createState(tenNinesSeed), { type: "start" }, host, 0);
	for (const answer of tenNinesSeed.rounds[0]!.answers) state = game.handle(state, { type: "answer", answer: answer.answer }, team, 1);
	expect(state.phase).toBe("revealed"); expect(state.revealed).toBe(true); expect(state.scores.devs).toBe(1000);
	expect(game.handle(state, { type: "answer", answer: "404" }, team, 2)).toBe(state);
	state = game.handle(state, { type: "next-round" }, host, 3);
	expect(state).toMatchObject({ phase: "open", roundIndex: 1, found: [] });
});
