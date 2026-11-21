import { describe, expect, test } from "bun:test";
import {
	afterCursor,
	compareIdentities,
	crossDayIdentities,
	identity,
	PAGE_SIZE,
	readIdentities,
	type Identity,
} from "../basin/event-parity";
const row = (
	id: string,
	source = "website",
	event = "website.page_view",
	copies = 1,
): Identity => ({ id, source, event, copies, versions: 1 });
describe("event identity parity", () => {
	test("equal counts cannot hide lost and substituted events", () => {
		const result = compareIdentities([row("a")], [row("b")]);
		expect(result).toMatchObject({
			passed: false,
			missingInBasin: 1,
			missingInPosthog: 1,
		});
	});
	test("source is part of identity and retries are informational", () => {
		const result = compareIdentities(
			[row("a"), row("a", "other")],
			[row("a", "website", undefined, 3), row("a", "other")],
		);
		expect(result).toMatchObject({ passed: true, basin: 2, repeatedBasin: 2 });
	});
	test("changed event names and conflicting identities fail", () => {
		expect(
			compareIdentities([row("a")], [row("a", "website", "website.sign_in")])
				.passed,
		).toBe(false);
		expect(
			compareIdentities([row("a")], [{ ...row("a"), versions: 2 }])
				.conflictingIdentities,
		).toBe(1);
	});
	test("empty days and invalid aggregation are never certified", () => {
		expect(compareIdentities([], []).passed).toBe(false);
		expect(() => identity(null, "a", "event", 1, 1)).toThrow();
		expect(() => identity("s", "a", "e", NaN, 1)).toThrow();
	});
	test("pagination fetches the next key and fails on repeated pages", async () => {
		const rows = Array.from({ length: PAGE_SIZE }, (_, i) =>
			row(String(i).padStart(5, "0")),
		);
		const cursors: unknown[] = [];
		const all = await readIdentities(async (cursor) => {
			cursors.push(cursor);
			return cursor ? [row("99999")] : rows;
		});
		expect(all).toHaveLength(PAGE_SIZE + 1);
		expect(cursors[1]).toMatchObject({ id: "00999" });
		await expect(readIdentities(async () => rows)).rejects.toThrow(
			"not ordered",
		);
	});
	test("a bounded export fails rather than ignoring remaining identities", async () => {
		const rows = Array.from({ length: PAGE_SIZE }, (_, i) =>
			row(String(i).padStart(5, "0")),
		);
		await expect(readIdentities(async () => rows, 0)).rejects.toThrow(
			"exceeds",
		);
	});
	test("cursor escaping follows each SQL dialect and rejects control characters", () => {
		expect(afterCursor({ source: "o'ne", id: "a\\b" }, "basin")).toContain(
			"'o''ne'",
		);
		expect(afterCursor({ source: "o'ne", id: "a\\b" }, "posthog")).toContain(
			"'o\\'ne'",
		);
		expect(() => afterCursor({ source: "s", id: "a\nb" }, "basin")).toThrow(
			"Control character",
		);
	});
	test("cross-day identity reuse is reported once per pair", () => {
		const seen = new Map<string, string>();
		expect(crossDayIdentities([row("a"), row("a")], "2026-11-11", seen)).toBe(
			0,
		);
		expect(crossDayIdentities([row("a"), row("a")], "2026-11-12", seen)).toBe(
			1,
		);
	});
});
