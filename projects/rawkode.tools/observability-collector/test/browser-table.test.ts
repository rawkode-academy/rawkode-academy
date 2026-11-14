import { describe, expect, test } from "bun:test";
import browserSql from "../basin/browser.sql" with { type: "text" };
import { BROWSER_COLUMNS } from "../basin/browser-columns";
import {
	browserParityPassed,
	browserQueries,
	browserWindow,
} from "../basin/browser-queries";

describe("browser table validation", () => {
	test("every projected column is compared with the archive", () => {
		expect(
			[...browserSql.matchAll(/ AS (\w+)/g)].map((match) => match[1]),
		).toEqual([...BROWSER_COLUMNS]);
		const queries = browserQueries("2026-11-12", "2026-11-13");
		expect(queries.parity).toContain("FROM analytics.events_archive");
		expect(queries.parity).toContain("FROM analytics.browser_events_v1");
		expect(queries.parity).not.toContain("FROM analytics_events");
		expect(queries.parity).not.toContain("INSERT INTO");
	});
	test("rejects partial, invalid, reversed and oversized windows before interpolation", () => {
		for (const [from, to] of [
			["2026-02-30", "2026-03-02"],
			["2026-11-12' OR 1=1", "2026-11-13"],
			["2026-11-13T00:00:00Z", "2026-11-14"],
			["2026-11-13", "2026-11-12"],
			["2026-01-01", "2026-03-01"],
		])
			expect(() => browserWindow(from!, to!)).toThrow();
	});
	test("fails closed for empty, malformed, conflicting and mismatched evidence", () => {
		const row = {
			archive_deliveries: 3,
			typed_deliveries: 2,
			archive_projections: 2,
			typed_projections: 2,
			missing_typed: 0,
			unexpected_typed: 0,
			archive_conflicts: 0,
			typed_conflicts: 0,
			archive_invalid: 0,
			typed_invalid: 0,
		};
		expect(browserParityPassed([row])).toBe(true);
		expect(browserParityPassed([])).toBe(false);
		expect(browserParityPassed([{}])).toBe(false);
		for (const field of [
			"missing_typed",
			"unexpected_typed",
			"archive_conflicts",
			"typed_conflicts",
			"archive_invalid",
			"typed_invalid",
		])
			expect(browserParityPassed([{ ...row, [field]: 1 }])).toBe(false);
		for (const value of [
			undefined,
			null,
			false,
			"",
			-1,
			Infinity,
			0.5,
			2 ** 54,
		])
			expect(browserParityPassed([{ ...row, missing_typed: value }])).toBe(
				false,
			);
		expect(
			browserParityPassed([
				{ ...row, archive_projections: 0, typed_projections: 0 },
			]),
		).toBe(false);
	});
});
