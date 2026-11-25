import { describe, expect, it } from "vitest";
import { reachQueries, reachWindow } from "@/lib/analytics/reach";

describe("reach window", () => {
	it("covers complete UTC days ending yesterday", () => {
		const w = reachWindow(new Date("2026-11-25T15:00:00Z"));
		expect(w.today).toBe("2026-11-25");
		expect(w.d30).toBe("2026-10-26");
		expect(w.d90).toBe("2026-08-27");
	});

	it("ends YouTube windows at its last reported day", () => {
		const w = reachWindow(new Date("2026-11-25T15:00:00Z"));
		expect(w.youtubeEnd).toBe("2026-11-22");
		expect(w.youtubeD30).toBe("2026-10-24");
		expect(w.youtubeD90).toBe("2026-08-25");
	});
});

describe("reach queries", () => {
	const queries = reachQueries(reachWindow(new Date("2026-11-25T15:00:00Z")));

	it("exclude bots from the web query", () => {
		expect(queries.web).toContain("bot_reason IS NULL");
	});

	it("never call json_get_* on browser events, whose imported rows exceed Basin's 2,000-byte limit", () => {
		expect(queries.web).not.toContain("json_get");
		expect(queries.web).toContain("substr(value, 1, 1500)");
	});

	it("bound every query by time and read no per-video or per-person fields", () => {
		for (const [name, sql] of Object.entries(queries)) {
			expect(sql, name).toMatch(/event_time >= CAST\(/);
			expect(sql, name).not.toMatch(/video_id|url_path|email|distinct_id/);
		}
	});

	it("keeps the latest YouTube row per day", () => {
		expect(queries.youtube).toContain("ROW_NUMBER()");
		expect(queries.youtube).toContain("'youtube.daily'");
	});

	it("reads the latest YouTube channel total", () => {
		expect(queries.subscribers).toContain("'youtube.channel_stats'");
		expect(queries.subscribers).toContain("ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC");
		expect(queries.subscribers).toContain("LIMIT 1");
	});
});
