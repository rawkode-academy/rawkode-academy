import assert from "node:assert/strict";
import { test } from "node:test";
import { ANSWERS, clampGuess, dailyPuzzle, markGuess, normalize, restoreGuesses, shareResult } from "../lib/games/kubele.ts";

test("same UTC date has one puzzle, including across time zones", () => {
	assert.deepEqual(dailyPuzzle(new Date("2026-10-13T00:00:00Z")), dailyPuzzle(new Date("2026-10-13T23:59:59Z")));
	assert.deepEqual(dailyPuzzle(new Date("2026-10-14T01:00:00+02:00")), dailyPuzzle(new Date("2026-10-13T23:00:00Z")));
	assert.notEqual(dailyPuzzle(new Date("2026-10-14T00:00:00Z")).answer.name, dailyPuzzle(new Date("2026-10-13T23:59:59Z")).answer.name);
});
test("exact matches consume letters before misplaced matches", () => {
	assert.deepEqual(markGuess("LLAMA", "ALARM"), ["absent", "correct", "correct", "present", "present"]);
	assert.deepEqual(markGuess("MMMM", "HELM"), ["absent", "absent", "absent", "correct"]);
	assert.throws(() => markGuess("HE", "HELM"));
});
test("multiword project and term names normalize to letters", () => {
	assert.equal(normalize("Inspektor Gadget"), "INSPEKTORGADGET");
	assert.equal(normalize("Service-Mesh"), "SERVICEMESH");
	assert.ok(ANSWERS.some(answer => answer.kind === "CNCF Sandbox project"));
	assert.ok(ANSWERS.some(answer => answer.kind === "Cloud native term"));
	assert.equal(new Set(ANSWERS.map(answer => normalize(answer.name))).size, ANSWERS.length);
});
test("saved data cannot contain extra guesses, wrong lengths, duplicates, or guesses after victory", () => {
	for (const value of ["invalid", "{}", '["HI"]', '["HELM","HELP"]', '["HELP","HELP"]', JSON.stringify(Array(7).fill("HELP"))]) assert.deepEqual(restoreGuesses(value, "HELM"), []);
	assert.deepEqual(restoreGuesses('["HELP","HELM"]', "HELM"), ["HELP", "HELM"]);
});
test("sharing includes feedback and score without exposing guesses or answer", () => {
	const result = shareResult("2026-10-13", ["HELP", "HELM"], "HELM");
	assert.match(result, /2\/6/); assert.match(result, /🟩/);
	assert.ok(!result.includes("HELM")); assert.ok(!result.includes("HELP"));
	assert.match(shareResult("2026-10-13", ["HELP"], "HELM"), /X\/6/);
});
test("input stops at the answer length so the board never hides extra letters", () => {
	assert.equal(clampGuess("KUBERNETESES", 11), "KUBERNETESE");
	assert.equal(clampGuess("Inspektor Gadget!", 15), "Inspektor Gadget!");
	assert.equal(clampGuess("Service-Mesh-Plus", 11), "Service-Mesh-");
	assert.equal(clampGuess("HE", 4), "HE");
});
