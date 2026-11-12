import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1, loadFixtures } from "./d1";

// Pinned clock: Swamp Club (2026-10-22T16:00Z) is upcoming.
const now = new Date("2026-10-18T12:00:00.000Z");
let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }, () => now), source, contextValue: {} });
	if (result.errors) throw result.errors[0];
	// Round-trip through JSON so scalars look the way they do on the wire.
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("videos read model", () => {
	it("imports every video, upcoming streams included", async () => {
		const { getAllVideos } = await query("{ getAllVideos { id } }");
		expect(getAllVideos).toHaveLength(11);
	});

	it("serves a video the way the website subgraph did", async () => {
		const { videoByID } = await query(`{ videoByID(id: "jmjdponjje5ueukwqlprmcbq") {
			id slug title description publishedAt updatedAt duration audioFileSize realtimeKit { streamId } type category streamUrl thumbnailUrl whatYouWillLearn } }`);
		expect(videoByID).toMatchObject({
			id: "jmjdponjje5ueukwqlprmcbq",
			slug: "hands-on-introduction-to-dapr",
			title: "Hands-on Introduction to Dapr",
			publishedAt: "2023-12-14T17:00:00.000Z",
			updatedAt: null,
			duration: 4632,
			audioFileSize: null,
			realtimeKit: null,
			type: "live",
			category: "tutorial",
			streamUrl: "https://content.rawkode.academy/videos/jmjdponjje5ueukwqlprmcbq/stream.m3u8",
			thumbnailUrl: "https://content.rawkode.academy/videos/jmjdponjje5ueukwqlprmcbq/thumbnail.webp",
		});
		expect(videoByID.whatYouWillLearn).toHaveLength(3);
		const { videoBySlug } = await query(`{ videoBySlug(slug: "hands-on-introduction-to-dapr") { id } }`);
		expect(videoBySlug.id).toBe("jmjdponjje5ueukwqlprmcbq");
	});

	it("serves full timestamps so upcoming streams keep their start time", async () => {
		const { videoBySlug } = await query(`{ videoBySlug(slug: "hands-on-introduction-to-swamp-club") {
			publishedAt updatedAt duration resources { title type url category } } }`);
		expect(videoBySlug).toEqual({
			publishedAt: "2026-10-22T16:00:00.000Z",
			updatedAt: "2026-10-23T17:29:23.000Z",
			duration: null,
			resources: [{ title: "Swamp Club", type: "url", url: "https://swamp-club.com", category: "other" }],
		});
	});

	it("serves resources and the podcast audio size", async () => {
		const { videoByID } = await query(`{ videoByID(id: "eoabgl7qts1lx2b0e5wwt3nf") {
			audioFileSize resources { id title description type url filePath embedConfig category } } }`);
		expect(videoByID.audioFileSize).toBe(65493300);
		expect(videoByID.resources).toEqual([
			{ id: null, title: "EventSauce", description: null, type: "url", url: "https://EventSauce.io", filePath: null, embedConfig: null, category: "code" },
			{ id: null, title: "The Knowledge of Others", description: null, type: "url", url: null, filePath: null, embedConfig: null, category: "other" },
		]);
	});

	it("serves realtimeKit and every resource field when they are set", async () => {
		await db.DB.prepare(`INSERT INTO videos (id, title, slug, description, publishedAt, type, realtime_kit, resources) VALUES ('rtk', 'RealtimeKit stream', 'rtk', 'A stream with a RealtimeKit meeting', 1900000000, 'live', ?, ?)`)
			.bind(
				JSON.stringify({ streamId: "s1", meetingId: "m1", livestreamName: "ls", roomName: "room" }),
				JSON.stringify([
					{ id: "slides", title: "Slides", description: "The deck", type: "file", filePath: "slides.pdf", category: "slides" },
					{ title: "Demo", type: "embed", embedConfig: { provider: "codepen", height: 400 }, category: "demos" },
				]),
			)
			.run();
		try {
			const { videoByID } = await query(`{ videoByID(id: "rtk") {
				realtimeKit { streamId meetingId livestreamName roomName }
				resources { id title description type url filePath embedConfig category } } }`);
			expect(videoByID).toEqual({
				realtimeKit: { streamId: "s1", meetingId: "m1", livestreamName: "ls", roomName: "room" },
				resources: [
					{ id: "slides", title: "Slides", description: "The deck", type: "file", url: null, filePath: "slides.pdf", embedConfig: null, category: "slides" },
					{ id: null, title: "Demo", description: null, type: "embed", url: null, filePath: null, embedConfig: { provider: "codepen", height: 400 }, category: "demos" },
				],
			});
		} finally {
			await db.DB.prepare("DELETE FROM videos WHERE id = 'rtk'").run();
		}
	});

	it("returns everything the website needs in one getAllVideos query", async () => {
		const { getAllVideos } = await query(`{ getAllVideos { id slug title subtitle tagline description whatYouWillLearn
			publishedAt updatedAt duration audioFileSize type category youtubeId streamUrl thumbnailUrl
			realtimeKit { streamId meetingId livestreamName roomName }
			resources { id title description type url filePath embedConfig category } } }`);
		expect(getAllVideos).toHaveLength(11);
		expect(getAllVideos[0].slug).toBe("hands-on-introduction-to-swamp-club");
		const dates = getAllVideos.map((v: { publishedAt: string }) => v.publishedAt);
		expect(dates).toEqual([...dates].sort().reverse());
		expect(getAllVideos.every((v: { resources: unknown[] }) => Array.isArray(v.resources))).toBe(true);
	});

	it("lists every video's id and updatedAt for change detection", async () => {
		const { getVideoVersions } = await query("{ getVideoVersions { id updatedAt } }");
		expect(getVideoVersions).toHaveLength(11);
		const ids = getVideoVersions.map((v: { id: string }) => v.id);
		expect(ids).toEqual([...ids].sort());
		expect(getVideoVersions.find((v: { id: string }) => v.id === "rez4r4sbaaog76765ijmdpli")).toEqual({
			id: "rez4r4sbaaog76765ijmdpli",
			updatedAt: "2026-10-23T17:29:23.000Z",
		});
		expect(getVideoVersions.filter((v: { updatedAt: string | null }) => v.updatedAt === null)).toHaveLength(10);
	});

	it("separates upcoming streams from published videos", async () => {
		const { getUpcomingVideos, getLatestVideos } = await query("{ getUpcomingVideos { slug publishedAt } getLatestVideos(limit: 400) { slug publishedAt } }");
		expect(getUpcomingVideos.map((v: { slug: string }) => v.slug)).toContain("hands-on-introduction-to-swamp-club");
		expect(getLatestVideos.map((v: { slug: string }) => v.slug)).not.toContain("hands-on-introduction-to-swamp-club");
		expect(getUpcomingVideos.length + getLatestVideos.length).toBe(11);
		const dates = getLatestVideos.map((v: { publishedAt: string }) => v.publishedAt);
		expect(dates).toEqual([...dates].sort().reverse());
	});

	it("searches published titles, descriptions and subtitles case-insensitively", async () => {
		const { simpleSearch } = await query(`{ simpleSearch(term: "DAPR") { slug } }`);
		expect(simpleSearch.map((v: { slug: string }) => v.slug)).toContain("hands-on-introduction-to-dapr");
		const { swamp } = await query(`{ swamp: simpleSearch(term: "Swamp Club") { slug } }`);
		expect(swamp).toEqual([]);
		const { wildcard } = await query(`{ wildcard: simpleSearch(term: "%") { slug } }`);
		expect(wildcard).toEqual([]);
	});

	it("returns random published videos", async () => {
		const { getRandomVideos } = await query("{ getRandomVideos(limit: 5) { slug } }");
		expect(getRandomVideos).toHaveLength(5);
		expect(getRandomVideos.map((v: { slug: string }) => v.slug)).not.toContain("hands-on-introduction-to-swamp-club");
	});

	it("resolves Video entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [{ __typename: "Video", id: "jmjdponjje5ueukwqlprmcbq" }]) { ... on Video { slug } } }`);
		expect(_entities).toEqual([{ slug: "hands-on-introduction-to-dapr" }]);
	});
});

describe("videos migrations", () => {
	it("upgrade a database created by the original service, keeping its rows", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0000_medical_flatman.sql");
		await old.DB.prepare("INSERT INTO videos (id, title, subtitle, slug, description, duration, publishedAt) VALUES ('legacy', 'Legacy', 'Sub', 'legacy', 'An old description', 60, 1600000000)").run();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0001_content_fields.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT title, subtitle, duration FROM videos WHERE id = 'legacy'").first()).toEqual({ title: "Legacy", subtitle: "Sub", duration: 60 });
		await loadFixtures(old.DB);
		expect((await old.DB.prepare("SELECT count(*) AS n FROM videos").first<{ n: number }>())?.n).toBe(12);
		await old.dispose();
	});
});
