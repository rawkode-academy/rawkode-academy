import { expect, test } from "bun:test";
import { mergeConflictSeed } from "../content/seed/merge-conflict";
import { createMergeConflict } from "./merge-conflict";
const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "compiler-club" };
test("Merge Conflict normalizes aliases, awards once, and keeps audience input private", () => {
	const game = createMergeConflict(mergeConflictSeed); let state = game.handle(game.createState(mergeConflictSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "audience-answer", answer: "dns" }, { id: "viewer", role: "audience" }, 1);
	state = game.handle(state, { type: "answer", answer: "works-on, my machine" }, team, 2);
	expect(state.scores[team.teamId]).toBe(38); expect(game.redact(state, "team")).not.toHaveProperty("audienceSubmissions");
});
