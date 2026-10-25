import { afterEach, describe, expect, it, vi } from "vitest";
import {
	dashboardQueries,
	parseRange,
	rangeStart,
	TABLE,
} from "@/lib/analytics/queries";
import { BasinQueryError, basinQuery, parseRows } from "@/server/basin";

describe("analytics dashboard queries", () => {
	it("defaults unknown ranges to 30 days", () => {
		expect(parseRange(null)).toBe("30d");
		expect(parseRange("1y")).toBe("30d");
		expect(parseRange("7d")).toBe("7d");
	});

	it("starts ranges at midnight UTC so cached results hold all day", () => {
		const now = new Date("2026-10-25T17:42:00Z");
		expect(rangeStart("7d", now)).toBe("2026-10-18T00:00:00.000Z");
	});

	it("bounds every query by time, since the table can't be partitioned", () => {
		for (const [name, sql] of Object.entries(dashboardQueries("7d"))) {
			expect(sql, name).toContain(`FROM ${TABLE}`);
			expect(sql, name).toMatch(/ts >= CAST\('[^']+' AS TIMESTAMP\)/);
		}
	});

	it("stays under Basin SQL's 10,000-row cap", () => {
		for (const [name, sql] of Object.entries(dashboardQueries("90d"))) {
			const limit = sql.match(/LIMIT (\d+)/)?.[1];
			if (limit) expect(Number(limit), name).toBeLessThanOrEqual(10_000);
		}
	});
});

describe("parseRows", () => {
	it("accepts row objects under result", () => {
		expect(parseRows({ result: { rows: [{ day: "2026-10-24", views: 3 }] } })).toEqual([
			{ day: "2026-10-24", views: 3 },
		]);
	});

	it("zips row arrays with the column schema", () => {
		expect(
			parseRows({
				result: {
					schema: [{ name: "event" }, { name: "events" }],
					rows: [["page_view", 10]],
				},
			}),
		).toEqual([{ event: "page_view", events: 10 }]);
	});

	it("returns no rows for an unexpected shape", () => {
		expect(parseRows(null)).toEqual([]);
		expect(parseRows({ result: {} })).toEqual([]);
	});
});

describe("basinQuery", () => {
	afterEach(() => vi.unstubAllGlobals());

	const config = { accountId: "acct", bucket: "rawkode-analytics", token: "t" };

	it("posts SQL to the account's bucket with the bearer token", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ success: true, result: { rows: [] } }));
		vi.stubGlobal("fetch", fetchMock);

		await basinQuery(config, "SELECT 1");

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(
			"https://api.sql.cloudflarestorage.com/api/v1/accounts/acct/basin-sql/query/rawkode-analytics",
		);
		expect((init as RequestInit).headers).toMatchObject({
			Authorization: "Bearer t",
		});
		expect(JSON.parse((init as RequestInit).body as string)).toEqual({
			query: "SELECT 1",
		});
	});

	it("surfaces Basin's error message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json(
					{ success: false, errors: [{ message: "table not found" }] },
					{ status: 400 },
				),
			),
		);
		await expect(basinQuery(config, "SELECT 1")).rejects.toThrow(
			new BasinQueryError("table not found", 400),
		);
	});
});
