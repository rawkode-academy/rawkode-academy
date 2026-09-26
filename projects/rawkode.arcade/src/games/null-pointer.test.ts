import { expect, test } from "bun:test";
import { nullPointerSeed } from "../content/seed/null-pointer";
import { createNullPointer } from "./null-pointer";
test("Null Pointer holds answers until the host reveal and scores the rare response", () => {
	const game = createNullPointer(nullPointerSeed); const host = { id: "h", role: "host" as const }; const team = { id: "t", role: "team" as const, teamId: "rare" }; let state = game.handle(game.createState(nullPointerSeed), { type: "start" }, host, 0);
	state = game.handle(state, { type: "answer", answer: "golang" }, team, 1); expect(game.redact(state, "audience")).not.toHaveProperty("teamAnswers"); state = game.handle(state, { type: "reveal", distribution: { Java: 4, Go: 1 } }, host, 2);
	expect(state.scores.rare).toBe(4); expect(state.revealedAnswers?.find((answer) => answer.answer === "Go")?.points).toBe(1);
});
