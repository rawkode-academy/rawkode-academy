import { describe, expect, test } from "vitest";
import { projectRoundProgress } from "../src/lib/round-progress";

describe("browser round progress", () => {
	test("maps the safe 0-based server contract to one-based UI progress", () => {
		expect(
			projectRoundProgress({ index: 1, total: 3, id: "spin-1", phase: "round" }, "question"),
		).toEqual({ questionNumber: 2, questionTotal: 3, phase: "round" });
	});
});
