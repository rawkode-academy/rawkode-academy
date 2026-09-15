import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadScenario } from "../src/scenario.ts";
import { validateScenario } from "../src/validate.ts";
import { FIXTURES, fakeConfig, tmp } from "./helpers.ts";

describe("validateScenario", () => {
	it("passes a scenario whose break bites and whose solve works", async () => {
		const s = await loadScenario(join(FIXTURES, "file-missing"), FIXTURES);
		const r = await validateScenario(s, fakeConfig(), await tmp());
		expect(r.ok).toBe(true);
		expect(r.steps.map((x) => x.step)).toEqual([
			"setup",
			"verify after setup is green",
			"break",
			"verify after break is red",
			"solve",
			"verify after solve is green",
			"invariants after solve",
		]);
	});

	it("rejects a scenario whose break leaves the cluster green", async () => {
		const s = await loadScenario(
			join(FIXTURES, "break-does-nothing"),
			FIXTURES,
		);
		const r = await validateScenario(s, fakeConfig(), await tmp());
		expect(r.ok).toBe(false);
		const red = r.steps.find((x) => x.step === "verify after break is red");
		expect(red?.ok).toBe(false);
	});
});
