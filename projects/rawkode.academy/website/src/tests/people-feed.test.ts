import type { APIContext } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { collections, getCollection } = vi.hoisted(() => ({
	collections: {} as Record<string, any[]>,
	getCollection: vi.fn(),
}));
vi.mock("astro:content", () => ({ getCollection, render: vi.fn() }));
import { GET, prerender } from "../pages/api/feeds/people/[id].xml";

const entry = (id: string, data = {}) => ({
	id,
	data: { id, name: id, title: id, description: "A & B", slug: id,
		publishedAt: new Date("2026-01-01"), authors: ["person"], guests: ["person"], ...data },
});
const context = (id: string | undefined) => ({
	params: { id }, props: {}, site: new URL("https://academy.test"),
}) as unknown as APIContext;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
	for (const key of Object.keys(collections)) delete collections[key];
	collections.people = [entry("person", { name: "Person & Friends" })];
	getCollection.mockImplementation(async (name, filter) =>
		(collections[name] ?? []).filter(filter ?? (() => true)));
});
afterEach(() => vi.useRealTimers());

describe("person RSS request-time contracts", () => {
	it("resolves params without static props and emits real RSS with escaped identity", async () => {
		collections.videos = [entry("talk")];
		const response = await GET(context("person"));
		const xml = await response.text();
		expect(prerender).toBe(false);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
		expect(xml).toContain("Rawkode Academy - Person &amp; Friends");
		expect(xml).toContain("https://academy.test/watch/talk/");
		expect(xml).not.toContain("undefined");
	});

	it.each(["unknown", undefined])("returns 404 for unknown/missing ID %s", async (id) => {
		const response = await GET(context(id));
		expect(response.status).toBe(404);
		expect(getCollection).toHaveBeenCalledTimes(1);
	});

	it("returns a valid named empty feed for a known host-only profile", async () => {
		collections.shows = [entry("show", { hosts: ["person"], publish: true })];
		const response = await GET(context("person"));
		const xml = await response.text();
		expect(response.status).toBe(200);
		expect(xml).toContain("Rawkode Academy - Person &amp; Friends");
		expect(xml).not.toContain("<item>");
	});

	it("filters future content while including legacy-flagged articles and excluding unrelated people", async () => {
		const future = new Date("2026-09-20T12:00:00.001Z");
		collections.articles = [entry("article"), entry("formerly-hidden", { draft: true }), entry("future-article", { publishedAt: future })];
		collections.news = [entry("news", { authors: [{ id: "person" }] }), entry("future-news", { publishedAt: future })];
		collections.videos = [entry("video", { guests: [{ id: "person" }], publishedAt: new Date() }),
			entry("future-recorded", { publishedAt: future, type: "recorded" }),
			entry("future-live", { publishedAt: future, type: "live" }),
			entry("unrelated", { guests: ["someone-else"] })];
		const xml = await (await GET(context("person"))).text();
		expect(xml.match(/<item>/g)).toHaveLength(4);
		for (const word of ["future-", "unrelated"]) expect(xml).not.toContain(word);
		for (const url of ["/read/article/", "/read/formerly-hidden/", "/news/news/", "/watch/video/"]) expect(xml).toContain(url);
		expect(xml.indexOf("/watch/video/")).toBeLessThan(xml.indexOf("/read/article/"));
	});

	it("does not trust an unrelated identity supplied through props", async () => {
		const request = context("person");
		request.props = { personId: "impostor", personName: "Wrong identity" };
		const xml = await (await GET(request)).text();
		expect(xml).toContain("Person &amp; Friends");
		expect(xml).not.toContain("Wrong identity");
	});
});
