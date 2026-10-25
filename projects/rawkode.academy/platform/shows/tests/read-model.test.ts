import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1, loadFixtures } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("shows read model", () => {
	it("lists every show, sorted by id", async () => {
		const { allShows } = await query("{ allShows { id } }");
		const ids = allShows.map((s: { id: string }) => s.id);
		expect(ids).toHaveLength(10);
		expect(ids).toEqual([...ids].sort());
	});

	it("serves a show with its status and publish flag", async () => {
		const { showById } = await query(`{ showById(id: "klustered") { id name description status published } }`);
		expect(showById).toMatchObject({ id: "klustered", name: "Klustered", status: "active", published: true });
		expect(showById.description).toContain("live gameshow");
	});

	it("maps coming-soon to a GraphQL enum value", async () => {
		await db.DB.prepare("UPDATE shows SET status = 'coming-soon' WHERE id = 'spinlock'").run();
		const { showById } = await query(`{ showById(id: "spinlock") { status } }`);
		expect(showById.status).toBe("coming_soon");
	});

	it("serves podcast metadata and subscribe links from their JSON columns", async () => {
		const { showById } = await query(`{ showById(id: "cloud-native-compass") {
			coverAlt
			podcast { guid email category subcategory explicit copyright artworkUrl }
			subscribeLinks { platform url icon } } }`);
		expect(showById.coverAlt).toBe("Cloud Native Compass podcast artwork");
		expect(showById.podcast).toEqual({
			guid: "560bcde1-b824-5054-b333-8be7ec30dd02",
			email: "team@rawkode.academy",
			category: "Technology",
			subcategory: "Software How-To",
			explicit: false,
			copyright: "Rawkode Academy",
			artworkUrl: null,
		});
		expect(showById.subscribeLinks).toHaveLength(6);
		expect(showById.subscribeLinks[0]).toEqual({
			platform: "Apple Podcasts",
			url: "https://podcasts.apple.com/us/podcast/cloud-native-compass/id1685669024",
			icon: "apple-podcasts",
		});
	});

	it("returns no podcast and an empty subscribe list for other shows", async () => {
		const { showById } = await query(`{ showById(id: "klustered") { podcast { email } subscribeLinks { url } } }`);
		expect(showById).toEqual({ podcast: null, subscribeLinks: [] });
	});

	it("serves the cover url once it is set", async () => {
		const url = "https://content.rawkode.academy/shows/cloud-native-compass/cover.png";
		await db.DB.prepare("UPDATE shows SET cover_url = ? WHERE id = 'cloud-native-compass'").bind(url).run();
		const { showById } = await query(`{ showById(id: "cloud-native-compass") { coverUrl } }`);
		expect(showById.coverUrl).toBe(url);
	});

	it("serves the cover dimensions, null until they are set", async () => {
		expect((await query(`{ showById(id: "klustered") { coverWidth coverHeight } }`)).showById).toEqual({ coverWidth: null, coverHeight: null });
		await db.DB.prepare("UPDATE shows SET cover_width = 1280, cover_height = 720 WHERE id = 'cloud-native-compass'").run();
		const { showById } = await query(`{ showById(id: "cloud-native-compass") { coverWidth coverHeight } }`);
		expect(showById).toEqual({ coverWidth: 1280, coverHeight: 720 });
	});

	it("serves updatedAt as an ISO DateTime, null until the row changes", async () => {
		expect((await query(`{ showById(id: "alphabits") { updatedAt } }`)).showById.updatedAt).toBeNull();
		await db.DB.prepare("UPDATE shows SET updated_at = 1792777295000 WHERE id = 'alphabits'").run();
		// graphql-scalars hands back a Date; the HTTP response carries it as JSON.
		const { showById } = await query(`{ showById(id: "alphabits") { updatedAt } }`);
		expect(JSON.parse(JSON.stringify(showById))).toEqual({ updatedAt: "2026-10-23T17:41:35.000Z" });
	});

	it("resolves Show entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [{ __typename: "Show", id: "klustered" }]) { ... on Show { name } } }`);
		expect(_entities).toEqual([{ name: "Klustered" }]);
	});
});

describe("shows migrations", () => {
	it("upgrade a database created by the original service", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0000_kind_hedge_knight.sql");
		await old.DB.prepare("INSERT INTO shows (id, name) VALUES ('klustered', 'Old name')").run();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0001_content_fields.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT name, status, published FROM shows WHERE id = 'klustered'").first()).toEqual({ name: "Old name", status: "active", published: 0 });
		await old.dispose();
	});

	it("add the nullable cover dimensions without touching existing rows", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0001_content_fields.sql");
		await old.DB.prepare("INSERT INTO shows (id, name) VALUES ('klustered', 'Klustered')").run();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0002_cover_dimensions.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT name, cover_width, cover_height FROM shows WHERE id = 'klustered'").first()).toEqual({ name: "Klustered", cover_width: null, cover_height: null });
		await old.dispose();
	});
});
