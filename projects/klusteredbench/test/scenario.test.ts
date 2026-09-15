import { describe, expect, it } from "vitest";
import {
	DEFAULT_SCENARIOS_DIR,
	loadScenarios,
	renderScript,
} from "../src/scenario.ts";

describe("shipped scenarios", () => {
	it("all load, match their directory names and carry the required scripts", async () => {
		const all = await loadScenarios(DEFAULT_SCENARIOS_DIR);
		expect(all.length).toBeGreaterThanOrEqual(11);
		for (const s of all) {
			expect(s.scripts.setup, `${s.id} setup`).not.toBeNull();
			expect(s.scripts.break, `${s.id} break`).not.toBeNull();
			expect(s.scripts.verify, `${s.id} verify`).not.toBeNull();
			expect(
				s.scripts.solve,
				`${s.id} solve (needed by validate)`,
			).not.toBeNull();
			expect(s.prompt.length).toBeGreaterThan(20);
			expect(s.timeoutMs).toBeGreaterThan(0);
			// Prompts must not leak the answer.
			expect(s.prompt.toLowerCase()).not.toContain("selector");
			expect(s.prompt.toLowerCase()).not.toContain("dnspolicy");
		}
		const ids = all.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("prepends the shared prelude to every rendered script", async () => {
		const [s] = await loadScenarios(DEFAULT_SCENARIOS_DIR, [
			"service-selector-typo",
		]);
		const verify = renderScript(s as NonNullable<typeof s>, "verify");
		expect(verify).toContain("kb_app_ok()");
		expect(verify).toContain("export -f");
		expect(verify?.trim().endsWith("kb_app_ok")).toBe(true);
	});

	it("rejects unknown scenario ids", async () => {
		await expect(
			loadScenarios(DEFAULT_SCENARIOS_DIR, ["nope"]),
		).rejects.toThrow(/Unknown scenario/);
	});
});
