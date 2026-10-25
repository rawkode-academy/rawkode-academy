import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

const agent = { id: "video-importer", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Learn " },
				{ type: "text", marks: [{ type: "bold" }], text: "Dapr" },
			],
		},
		{ type: "paragraph", content: [{ type: "text", text: "Live." }] },
	],
};
const dapr = "jmjdponjje5ueukwqlprmcbq";
const swamp = "rez4r4sbaaog76765ijmdpli";

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	store = new ContentStore(models, { DB: db.DB });
});
afterAll(() => db.dispose());

describe("videos write model", () => {
	it("accepts every stored video as it is, keeping its description", async () => {
		const page = await store.list("video", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"video",
				String(row.id),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			}
			expect(result.value.value.description).toBe(row.description);
			expect(result.value.value.descriptionDoc).toMatchObject({ type: "doc" });
		}
	});

	it("lists the newest videos first and searches title, slug and YouTube id", async () => {
		const page = await store.list("video", { limit: 2 });
		expect(page.ok && page.value.rows.map((r) => r.id)).toEqual([swamp, dapr]);
		const byYoutube = await store.list("video", { search: "IQnJz" });
		expect(byYoutube.ok && byYoutube.value.rows.map((r) => r.id)).toEqual([
			swamp,
		]);
		const bySlug = await store.list("video", { search: "event-sourcing" });
		expect(bySlug.ok && bySlug.value.total).toBe(1);
	});

	it("creates a video with a generated cuid", async () => {
		const created = await store.create(
			"video",
			{
				title: "Hands-on Introduction to Kueue",
				slug: "hands-on-introduction-to-kueue",
				description: "",
				descriptionDoc: doc,
				publishedAt: "2026-11-01T17:00:00.000Z",
				type: "live",
				category: "tutorial",
				youtubeId: "tKc8Rna3vDQ",
				whatYouWillLearn: ["Queue batch jobs on Kubernetes"],
				resources: [
					{
						title: "Kueue",
						type: "url",
						url: "https://kueue.sigs.k8s.io/",
						category: "documentation",
					},
				],
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.id).toMatch(/^[a-z0-9]{24}$/);
		expect(created.value.value.publishedAt).toEqual(
			new Date("2026-11-01T17:00:00.000Z"),
		);
		expect(created.value.value.updatedAt).toBeInstanceOf(Date);
	});

	it("keeps description as the plain-text copy of descriptionDoc", async () => {
		const updated = await store.update(
			"video",
			dapr,
			{ descriptionDoc: doc },
			{ ifVersion: 1 },
			agent,
		);
		if (!updated.ok) throw new Error(JSON.stringify(updated.error));
		expect(updated.value.value.description).toBe("Learn Dapr\n\nLive.");
	});

	it("builds descriptionDoc from plain text the way the importer does", async () => {
		const description =
			"Kueue, live.\nSlides: https://example.com/kueue_slides.\n\n1. Not a list *or* <b>markup</b>";
		const created = await store.create(
			"video",
			{
				id: "kueuelive0000000000000001",
				title: "Kueue",
				slug: "kueue",
				description: `${description}\r\n`,
				publishedAt: "2026-11-01T17:00:00.000Z",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.description).toBe(description);
		expect(created.value.value.descriptionDoc).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "Kueue, live." },
						{ type: "hardBreak" },
						{ type: "text", text: "Slides: " },
						{
							type: "text",
							text: "https://example.com/kueue_slides",
							marks: [
								{
									type: "link",
									attrs: { href: "https://example.com/kueue_slides" },
								},
							],
						},
						{ type: "text", text: "." },
					],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "1. Not a list *or* <b>markup</b>" }],
				},
			],
		});
	});

	it("stores no document for a video without a description", async () => {
		const created = await store.create(
			"video",
			{
				title: "Upcoming",
				slug: "upcoming",
				description: "  ",
				publishedAt: "2026-12-01T17:00:00.000Z",
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.description).toBe("");
		expect(created.value.value.descriptionDoc).toBeNull();
	});

	it("rejects values the website cannot render", async () => {
		const result = await store.create(
			"video",
			{
				id: "Not-A-Cuid",
				title: " ",
				slug: "Not A Slug",
				description: "x",
				publishedAt: "never",
				type: "premiere",
				category: "vlog",
				youtubeId: "https://youtu.be/tKc8Rna3vDQ",
				duration: -1,
				whatYouWillLearn: [""],
				resources: [
					{ title: "Slides", type: "pdf", url: "nope", category: "slides" },
				],
				descriptionDoc: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"id",
				"title",
				"slug",
				"publishedAt",
				"type",
				"category",
				"youtubeId",
				"duration",
				"whatYouWillLearn.0",
				"resources.0.type",
				"resources.0.url",
				"descriptionDoc",
			].sort(),
		);
	});

	it("refuses a slug another video has", async () => {
		const result = await store.create(
			"video",
			{
				title: "Dapr again",
				slug: "hands-on-introduction-to-dapr",
				description: "Again.",
				publishedAt: "2026-11-01T17:00:00.000Z",
			},
			agent,
		);
		expect(!result.ok && result.error.code).toBe("validation");
	});
});
