import { describe, expect, it } from "vitest";
import { parseAcademyVideos, guestVideosSql } from "@/lib/analytics/guest";
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
			castingCredits: [
				{ role: "GUEST", person: { id: "icepuma", githubHandle: "icepuma" } },
				{ role: "HOST", person: { id: "rawkode", githubHandle: "rawkode" } },
			],
			episode: { show: { id: "show" } },
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

	it("shows a guest their episode and a host the episodes they are credited on", () => {
		const videos = parseAcademyVideos(data) ?? [];
		expect(visibleEpisodes(videos, "icepuma").map((episode) => episode.role)).toEqual(["guest"]);
		expect(visibleEpisodes(videos, "rawkode").map((episode) => episode.id)).toEqual(["v1"]);
		expect(visibleEpisodes(videos, "nobody")).toEqual([]);
	});

	it("a co-host not credited on a video does not see it, and a video with no credits is seen by nobody", () => {
		const videos = parseAcademyVideos({
			getAllVideos: [
				{ id: "v3", title: "Credited", slug: "credited", youtubeId: null, castingCredits: [{ role: "HOST", person: { id: "rawkode", githubHandle: "rawkode" } }], episode: { show: { id: "show" } } },
				{ id: "v4", title: "Uncredited", slug: "uncredited", youtubeId: null, episode: { show: { id: "show" } } },
			],
			allCourses: [],
		}) ?? [];
		expect(visibleEpisodes(videos, "rawkode").map((episode) => episode.id)).toEqual(["v3"]);
		expect(visibleEpisodes(videos, "cohost")).toEqual([]);
	});

	it("shows a course author the course's lesson videos", () => {
		const videos = parseAcademyVideos(data) ?? [];
		expect(visibleEpisodes(videos, "teacher").map((episode) => episode.id)).toEqual(["v2"]);
	});

	it("sums deduplicated daily rows over 90 days and lifetime", () => {
		const sql = guestVideosSql(["AAAAAAAAAAA"], reachWindow(new Date("2026-11-25T15:00:00Z")));
		expect(sql).toContain("GROUP BY video");
		expect(sql).toContain("ROW_NUMBER()");
		expect(sql).toContain("WHERE rn = 1");
		expect(sql).toContain("IN ('AAAAAAAAAAA')");
		expect(sql).toContain("day >= '2026-08-25'");
		expect(sql).toContain("BETWEEN '2018-01-01' AND '2026-11-22'");
	});
});
