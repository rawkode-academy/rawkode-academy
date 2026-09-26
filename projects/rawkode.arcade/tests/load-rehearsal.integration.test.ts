import { describe, expect, it } from "vitest";
import { ProbeLedger } from "../scripts/load-rehearsal-metrics";

describe("load rehearsal correlation", () => {
	it("tracks acceptance and origin aggregate visibility independently for 4,000 votes", () => {
		const ledger = new ProbeLedger();
		const byShard = new Map<string, string[]>();
		for (let index = 0; index < 4_000; index += 1) {
			const id = `vote-${index}`;
			const shardId = String(index % 32);
			ledger.register({ id, promptId: "prompt-live", shardId, sentAt: 0 });
			ledger.recordAccepted(id, 5 + (index % 10));
			const ids = byShard.get(shardId) ?? [];
			ids.push(id);
			byShard.set(shardId, ids);
		}

		for (const [shardId, ids] of byShard) {
			for (let offset = 0; offset < ids.length; offset += 100) {
				const batch = ids.slice(offset, offset + 100);
				expect(batch.length).toBeLessThanOrEqual(100);
				expect(
					ledger.recordAggregateVisible(
						batch,
						"prompt-live",
						shardId,
						40 + offset / 100,
					),
				).toBe(batch.length);
			}
		}

		const summary = ledger.summary();
		expect(summary.sent).toBe(4_000);
		expect(summary.rejected).toBe(0);
		expect(summary.pending).toBe(0);
		expect(summary.acceptance.completed).toBe(4_000);
		expect(summary.acceptance.p95Ms).toBe(14);
		expect(summary.aggregateCommitVisibility.completed).toBe(4_000);
		expect(summary.aggregateCommitVisibility.p95Ms).toBe(41);
		expect(summary.aggregateCommitVisibility.timedOut).toBe(0);
	});

	it("does not count the wrong prompt, shard, duplicates, or timeouts as visibility", () => {
		const ledger = new ProbeLedger();
		ledger.register({ id: "vote-1", promptId: "prompt-1", shardId: "7", sentAt: 10 });

		expect(ledger.recordAccepted("vote-1", 20)).toBe(true);
		expect(ledger.recordAccepted("vote-1", 21)).toBe(false);
		expect(ledger.recordAggregateVisible(["vote-1"], "prompt-2", "7", 30)).toBe(0);
		expect(ledger.recordAggregateVisible(["vote-1"], "prompt-1", "8", 30)).toBe(0);
		expect(ledger.recordVisibilityTimeout("vote-1")).toBe(true);

		const summary = ledger.summary();
		expect(summary.acceptance.completed).toBe(1);
		expect(summary.aggregateCommitVisibility.completed).toBe(0);
		expect(summary.aggregateCommitVisibility.timedOut).toBe(1);
		expect(summary.pending).toBe(0);
	});
});
