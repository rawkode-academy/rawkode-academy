import { describe, expect, it } from "vitest";
import { parseAcademyVideos, guestTotalsSql } from "@/lib/analytics/guest";
import { reachWindow } from "@/lib/analytics/reach";
import { visibleEpisodes } from "../../../../../packages/guest-scope/index";

const data = {
	getAllVideos: [
		{
			id: "v1",
			title: "Guest episode",
			slug: "guest-episode",
			publishedAt: "2026-01-02T00:00:00.000Z",
			youtubeId: "AAAAAAAAAAA",
			guests: [{ id: "icepuma", githubHandle: "icepuma" }],
			episode: { show: { id: "show", hosts: [{ id: "rawkode", githubHandle: "rawkode" }] } },
		},
		{ id: "v2", title: "Other", slug: "other", youtubeId: null, guests: [], episode: null },
		{ title: "no id", guests: [] },
	],
	allCourses: [
		{
			authors: [{ id: "teacher", githubHandle: "teacher" }],
			modules: [{ video: { id: "v2" } }, { video: null }],
		},
	],
};

describe("guest analytics", () => {
	it("reads the gateway answer and skips unusable rows", () => {
		const videos = parseAcademyVideos(data) ?? [];
		expect(videos.map((video) => video.id)).toEqual(["v1", "v2"]);
		expect(parseAcademyVideos({})).toBeUndefined();
		expect(parseAcademyVideos(null)).toBeUndefined();
	});

	it("shows a guest their episode and a host every episode of the show", () => {
		const videos = parseAcademyVideos(data) ?? [];
		expect(visibleEpisodes(videos, "icepuma").map((episode) => episode.role)).toEqual(["guest"]);
		expect(visibleEpisodes(videos, "rawkode").map((episode) => episode.id)).toEqual(["v1"]);
		expect(visibleEpisodes(videos, "nobody")).toEqual([]);
	});

	it("shows a course author the course's lesson videos", () => {
		const videos = parseAcademyVideos(data) ?? [];
		expect(visibleEpisodes(videos, "teacher").map((episode) => episode.id)).toEqual(["v2"]);
	});

	it("sums deduplicated daily rows over 90 days and lifetime", () => {
		const sql = guestTotalsSql(["AAAAAAAAAAA"], reachWindow(new Date("2026-11-25T15:00:00Z")));
		expect(sql).toContain("ROW_NUMBER()");
		expect(sql).toContain("WHERE rn = 1");
		expect(sql).toContain("IN ('AAAAAAAAAAA')");
		expect(sql).toContain("day >= '2026-08-25'");
		expect(sql).toContain("BETWEEN '2018-01-01' AND '2026-11-22'");
	});
});
