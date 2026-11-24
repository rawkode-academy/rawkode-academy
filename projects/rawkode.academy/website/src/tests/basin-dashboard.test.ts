import { afterEach, describe, expect, it, vi } from "vitest";
import {
	dashboardQueries,
	HUMAN,
	LINK_HUMAN,
	LINKS_TABLE,
	parseRange,
	rangeStart,
	TABLE,
	TYPED_HUMAN,
	WEB_PAGE_LEAVES_TABLE,
	WEB_VITALS_TABLE,
} from "@/lib/analytics/queries";

const SOURCES: Record<string, string> = {
	links: LINKS_TABLE,
	linkTotals: LINKS_TABLE,
	vitals: WEB_VITALS_TABLE,
	pageLeave: WEB_PAGE_LEAVES_TABLE,
};
const FILTERS: Record<string, string> = {
	links: LINK_HUMAN,
	linkTotals: LINK_HUMAN,
	vitals: TYPED_HUMAN,
	pageLeave: TYPED_HUMAN,
};

import { BasinQueryError, basinQuery, parseRows } from "@/server/basin";

describe("analytics dashboard queries", () => {
	it("defaults unknown ranges to 30 days", () => {
		expect(parseRange(null)).toBe("30d");
		expect(parseRange("1y")).toBe("30d");
		expect(parseRange("7d")).toBe("7d");
	});

	it("rejects inherited property names as ranges", () => {
		for (const value of ["constructor", "__proto__", "toString"]) {
			expect(parseRange(value)).toBe("30d");
		}
	});

	it("starts ranges at midnight UTC so cached results hold all day", () => {
		const now = new Date("2026-10-25T17:42:00Z");
		expect(rangeStart("7d", now)).toBe("2026-10-18T00:00:00.000Z");
	});

	it("bounds every query by time, since the table can't be partitioned", () => {
		for (const [name, sql] of Object.entries(dashboardQueries("7d"))) {
			expect(sql, name).toContain(`FROM ${SOURCES[name] ?? TABLE}`);
			expect(sql, name).toMatch(/event_time >= CAST\('[^']+' AS TIMESTAMP\)/);
		}
	});

	it("reads redirects from the legacy and labelled tables", () => {
		for (const sql of [
			dashboardQueries("7d").links,
			dashboardQueries("7d").linkTotals,
		]) {
			expect(sql).toContain("FROM analytics.short_links");
			expect(sql).toContain("FROM analytics.short_link_redirects");
		}
	});

	it("leaves labelled bot traffic out of every query", () => {
		for (const [name, sql] of Object.entries(dashboardQueries("7d")))
			expect(sql, name).toContain(FILTERS[name] ?? HUMAN);
	});

	it("reads redirect fields from the typed sink and excludes unmatched paths", () => {
		const queries = dashboardQueries("7d");
		expect(queries.links).toContain("SELECT domain, path");
		for (const sql of [queries.links, queries.linkTotals]) {
			expect(sql).toContain("matched = true");
			expect(sql).not.toContain("is_bot");
		}
	});

	it("uses CloudEvent names and data", () => {
		const queries = dashboardQueries("7d");
		expect(queries.signIn).toContain("event_source");
		expect(queries.signIn).toContain("event_type");
		expect(queries.video).toContain("json_get_str(value, 'data', 'video_id')");
		expect(queries.video).toContain("'anonymous'");
		expect(queries.newsletter).toContain("newsletter.submission_attempted");
		expect(queries.newsletter).not.toContain("newsletter_cta_impression");
	});

	it("reads browser reporting from rawkode-academy-browser events", () => {
		const queries = dashboardQueries("7d");
		for (const name of [
			"traffic",
			"pages",
			"referrers",
			"funnel",
			"clicks",
			"exceptions",
		] as const) {
			expect(queries[name], name).toContain(
				"event_source = 'rawkode-academy-browser'",
			);
			// At-least-once delivery: count distinct event IDs.
			expect(queries[name], name).toContain("approx_distinct(event_id)");
		}
		expect(queries.funnel).toContain("/organizations/partnerships");
		expect(queries.funnel).toContain("web.enquiry_form_submitted");
		expect(queries.clicks).toContain("web.rage_click");
		expect(queries.vitals).toContain(
			"approx_percentile_cont(metric_value, 0.75)",
		);
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
		expect(
			parseRows({ result: { rows: [{ day: "2026-10-24", views: 3 }] } }),
		).toEqual([{ day: "2026-10-24", views: 3 }]);
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
			.mockResolvedValue(
				Response.json({ success: true, result: { rows: [] } }),
			);
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
			vi
				.fn()
				.mockResolvedValue(
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
