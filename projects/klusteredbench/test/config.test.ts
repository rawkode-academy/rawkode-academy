import { describe, expect, it } from "vitest";
import { parseBenchConfig } from "../src/config.ts";
import { formatDuration, parseDuration } from "../src/util/time.ts";

describe("parseBenchConfig", () => {
	it("applies defaults", () => {
		const c = parseBenchConfig({
			provider: { type: "kind" },
			agents: [{ name: "a", type: "builtin", model: "claude-opus-5" }],
		});
		expect(c.trials).toBe(1);
		expect(c.timeoutMs).toBe(15 * 60_000);
		expect(c.pollIntervalMs).toBe(5_000);
		expect(c.scenarios).toBe("all");
		expect(c.stopOnGreen).toBe(false);
	});

	it("rejects duplicate agent names and missing providers", () => {
		expect(() =>
			parseBenchConfig({ agents: [{ name: "a", type: "fake" }] }),
		).toThrow(/provider/);
		expect(() =>
			parseBenchConfig({
				provider: { type: "fake" },
				agents: [
					{ name: "a", type: "fake" },
					{ name: "a", type: "fake" },
				],
			}),
		).toThrow(/duplicate/);
	});
});

describe("durations", () => {
	it("parses and formats", () => {
		expect(parseDuration("15m")).toBe(900_000);
		expect(parseDuration("2.5s")).toBe(2_500);
		expect(parseDuration(42)).toBe(42);
		expect(() => parseDuration("soon")).toThrow();
		expect(formatDuration(500)).toBe("500ms");
		expect(formatDuration(65_000)).toBe("1m05s");
		expect(formatDuration(null)).toBe("-");
	});
});
