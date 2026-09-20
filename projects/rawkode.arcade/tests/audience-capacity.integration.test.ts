import { describe, expect, it } from "vitest";
import { AUDIENCE_OTHER_BIN, boundedAudienceBin, MAX_AUDIENCE_BINS_PER_SHARD, validAudienceTotals } from "../src/domain/audience-choice";

describe("audience storage capacity", () => {
	it("bounds 10,000 distinct maximum-length answers across 32 shards below the room row limit", () => {
		const shards = Array.from({ length: 32 }, () => new Map<string, number>());
		for (let index = 0; index < 10_000; index += 1) {
			const shard = shards[index % shards.length]!;
			const adversarial = `${String(index).padStart(5, "0")}-${'\\"'.repeat(47)}`.slice(0, 100);
			const bin = boundedAudienceBin(new Set(shard.keys()), adversarial);
			shard.set(bin, (shard.get(bin) ?? 0) + 1);
		}
		const audienceShards = Object.fromEntries(shards.map((totals, index) => [String(index), Object.fromEntries(totals)]));
		const totals: Record<string, number> = {};
		for (const shard of shards) for (const [choice, total] of shard) totals[choice] = (totals[choice] ?? 0) + total;
		const serialized = JSON.stringify({ audience: { totals }, audienceDistribution: totals, private: { audienceShards } });
		expect(shards.every((shard) => shard.size <= MAX_AUDIENCE_BINS_PER_SHARD + 1)).toBe(true);
		expect(shards.every((shard) => shard.has(AUDIENCE_OTHER_BIN))).toBe(true);
		expect(shards.every((shard) => validAudienceTotals(Object.fromEntries(shard)))).toBe(true);
		expect(Object.values(totals).reduce((sum, total) => sum + total, 0)).toBe(10_000);
		expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(1_000_000);
	});
});
