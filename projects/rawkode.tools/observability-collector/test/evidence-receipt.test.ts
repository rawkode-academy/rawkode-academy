import { describe, expect, test } from "bun:test";
import { evidenceContext, evidenceSummary } from "../basin/evidence-receipt";
const NOW = Date.parse("2026-11-14T07:00:00.000Z");
function receipt() {
	return {
		schema_version: 1,
		scope: "collector-cloud-event-id-parity",
		generated_at: "2026-11-14T07:00:00.000Z",
		cutover_ready: false,
		status: "passed",
		window: {
			from: "2026-11-13T00:00:00.000Z",
			to: "2026-11-14T00:00:00.000Z",
			ingestion_started: "2026-11-01T12:00:00.000Z",
			settle_hours: 6,
		},
		days: [
			{
				day: "2026-11-13",
				posthog: 2,
				basin: 2,
				repeatedPosthog: 1,
				repeatedBasin: 0,
				missingInBasin: 0,
				missingInPosthog: 0,
				mismatchedEvents: 0,
				conflictingIdentities: 0,
				crossDayIdentities: 0,
				sources: [{ source: "untrusted-source-string", posthog: 2, basin: 2 }],
				passed: true,
			},
		],
	};
}
describe("CI parity evidence", () => {
	test("only emits allowlisted aggregates, not source strings, raw extras or credentials", () => {
		const input = {
			...receipt(),
			token: "private-secret",
			arbitrary: "private-field",
		};
		const summary = evidenceSummary(input, 0, NOW);
		expect(summary.status).toBe("passed");
		expect(summary.cutover_ready).toBe(false);
		expect(summary.days[0]?.source_count).toBe(1);
		const output = JSON.stringify(summary);
		for (const secret of [
			"private-secret",
			"private-field",
			"untrusted-source-string",
		])
			expect(output).not.toContain(secret);
	});
	test("fails closed for stale, future, partial and misaligned windows", () => {
		for (const now of [NOW + 16 * 60000, NOW - 61000])
			expect(() => evidenceSummary(receipt(), 0, now)).toThrow();
		for (const field of ["from", "to", "ingestion_started"] as const) {
			const input = receipt();
			input.window[field] = "invalid";
			expect(() => evidenceSummary(input, 0, NOW)).toThrow();
		}
		const partial = receipt();
		partial.window.from = "2026-11-13T01:00:00.000Z";
		expect(() => evidenceSummary(partial, 0, NOW)).toThrow();
	});
	test("does not certify exit-code disagreement, invalid counts, inconsistent source sums or false pass flags", () => {
		expect(() => evidenceSummary(receipt(), 1, NOW)).toThrow();
		const invalid = receipt();
		invalid.days[0]!.posthog = -1;
		expect(() => evidenceSummary(invalid, 0, NOW)).toThrow();
		const inconsistent = receipt();
		inconsistent.days[0]!.sources[0]!.basin = 1;
		expect(() => evidenceSummary(inconsistent, 0, NOW)).toThrow();
		const unequal = receipt();
		unequal.days[0]!.basin = 3;
		unequal.days[0]!.sources[0]!.basin = 3;
		expect(() => evidenceSummary(unequal, 0, NOW)).toThrow();

		const falsePass = receipt();
		falsePass.days[0]!.missingInBasin = 1;
		expect(() => evidenceSummary(falsePass, 0, NOW)).toThrow();
		const conflicts = receipt();
		conflicts.days[0]!.crossDayIdentities = 1;
		expect(() => evidenceSummary(conflicts, 0, NOW)).toThrow();
		const cutover = { ...receipt(), cutover_ready: true };
		expect(() => evidenceSummary(cutover, 0, NOW)).toThrow();
	});
	test("preserves actual failed/empty evidence without promoting it to cutover readiness", () => {
		const failed = receipt();
		failed.status = "failed";
		failed.days[0]!.missingInBasin = 1;
		failed.days[0]!.passed = false;
		expect(evidenceSummary(failed, 1, NOW).status).toBe("failed");
		const empty = { ...receipt(), status: "insufficient_data", days: [] };
		expect(evidenceSummary(empty, 2, NOW).status).toBe("insufficient_data");
		expect(() => evidenceSummary(empty, 0, NOW)).toThrow();
	});
	test("only runs scheduled/manual evidence for the intended repository on main", () => {
		const env = {
			GITHUB_REPOSITORY: "rawkode-academy/rawkode-academy",
			GITHUB_REF: "refs/heads/main",
			GITHUB_EVENT_NAME: "workflow_dispatch",
			GITHUB_SHA: "a".repeat(40),
			GITHUB_RUN_ID: "1234",
		};
		expect(evidenceContext(env).source_commit).toBe(env.GITHUB_SHA);
		for (const changed of [
			{ GITHUB_REF: "refs/heads/feature" },
			{ GITHUB_EVENT_NAME: "pull_request" },
			{ GITHUB_REPOSITORY: "someone/fork" },
			{ GITHUB_SHA: "not-a-commit" },
			{ GITHUB_RUN_ID: "private-secret" },
		])
			expect(() => evidenceContext({ ...env, ...changed })).toThrow();
	});
});
