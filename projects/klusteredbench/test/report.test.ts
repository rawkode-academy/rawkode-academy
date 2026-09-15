import { describe, expect, it } from "vitest";
import { aggregate, renderMarkdown } from "../src/report.ts";
import { trial } from "./helpers.ts";

describe("aggregate", () => {
	it("computes per-cell and per-agent stats, preferring reported cost", () => {
		const trials = [
			trial({
				agent: "a",
				trial: 1,
				timeToGreenMs: 10_000,
				estimatedCostUsd: 0.1,
			}),
			trial({
				agent: "a",
				trial: 2,
				timeToGreenMs: 30_000,
				estimatedCostUsd: 0.3,
			}),
			trial({
				agent: "a",
				trial: 3,
				success: false,
				greenAtEnd: false,
				timeToGreenMs: null,
				exitReason: "timeout",
				estimatedCostUsd: 0.5,
			}),
			trial({
				agent: "cc",
				agentType: "claude-code",
				trial: 1,
				estimatedCostUsd: 0.2,
				reportedCostUsd: 0.25,
			}),
		];
		const r = aggregate(trials);
		const a = r.cells.find((c) => c.agent === "a");
		expect(a?.trials).toBe(3);
		expect(a?.successRate).toBeCloseTo(2 / 3);
		expect(a?.medianTimeToGreenMs).toBe(20_000);
		expect(a?.totalCostUsd).toBeCloseTo(0.9);
		expect(a?.costPerSuccessUsd).toBeCloseTo(0.45);
		expect(a?.timeouts).toBe(1);
		const cc = r.cells.find((c) => c.agent === "cc");
		expect(cc?.totalCostUsd).toBe(0.25);
		expect(r.agents[0]?.agent).toBe("cc"); // 100% beats 67%
	});

	it("reports infinite cost per success when nothing succeeded and n/a when unpriced", () => {
		const r = aggregate([
			trial({
				agent: "x",
				success: false,
				greenAtEnd: false,
				timeToGreenMs: null,
			}),
			trial({ agent: "y", scenario: "other", estimatedCostUsd: null }),
		]);
		expect(r.cells.find((c) => c.agent === "x")?.costPerSuccessUsd).toBe(
			Number.POSITIVE_INFINITY,
		);
		expect(r.cells.find((c) => c.agent === "y")?.costPerSuccessUsd).toBeNull();
		const md = renderMarkdown(r);
		expect(md).toContain("| x ");
		expect(md).toContain("inf");
		expect(md).toContain("n/a");
	});
});
