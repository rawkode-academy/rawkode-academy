import { describe, expect, it } from "vitest";
import {
	addUsage,
	DEFAULT_PRICING,
	estimateCostUsd,
	totalTokens,
} from "../src/pricing.ts";

describe("pricing", () => {
	it("prices each token class separately", () => {
		const cost = estimateCostUsd("claude-opus-5", {
			inputTokens: 1_000_000,
			outputTokens: 100_000,
			cacheWriteTokens: 200_000,
			cacheReadTokens: 2_000_000,
		});
		// 5 + 2.5 + 0.2*6.25 + 2*0.5
		expect(cost).toBeCloseTo(5 + 2.5 + 1.25 + 1, 6);
	});

	it("returns null instead of guessing for unknown models", () => {
		expect(
			estimateCostUsd("gpt-whatever", {
				inputTokens: 1,
				outputTokens: 1,
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
			}),
		).toBeNull();
	});

	it("honours a pricing override", () => {
		const cost = estimateCostUsd(
			"claude-opus-5",
			{
				inputTokens: 1_000_000,
				outputTokens: 0,
				cacheWriteTokens: 0,
				cacheReadTokens: 0,
			},
			{
				...DEFAULT_PRICING,
				"claude-opus-5": { input: 1, output: 1, cacheWrite: 1, cacheRead: 1 },
			},
		);
		expect(cost).toBe(1);
	});

	it("adds and totals usage", () => {
		const u = addUsage(
			{
				inputTokens: 1,
				outputTokens: 2,
				cacheWriteTokens: 3,
				cacheReadTokens: 4,
			},
			{ outputTokens: 10 },
		);
		expect(u).toEqual({
			inputTokens: 1,
			outputTokens: 12,
			cacheWriteTokens: 3,
			cacheReadTokens: 4,
		});
		expect(totalTokens(u)).toBe(20);
	});
});
