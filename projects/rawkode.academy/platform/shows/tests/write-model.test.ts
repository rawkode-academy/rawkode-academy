import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { documentFromMarkdown } from "@rawkodeacademy/content-model/rich-text";
import { ContentStore } from "@rawkodeacademy/content-write";
import { models } from "../write-model/models";
import { loadFixtures, migratedD1 } from "./d1";

type ChangeQueue = NonNullable<
	ConstructorParameters<typeof ContentStore>[1]["CONTENT_CHANGES"]
>;
type ChangeEvent = Parameters<ChangeQueue["send"]>[0];

const agent = { id: "shows-skill", kind: "agent" as const };
const doc = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Break it, then " },
				{ type: "text", text: "fix it", marks: [{ type: "bold" }] },
				{ type: "text", text: "." },
			],
		},
	],
};

let db: Awaited<ReturnType<typeof migratedD1>>;
let store: ContentStore;
const sent: ChangeEvent[] = [];

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
	const queue = {
		send: async (event: ChangeEvent) => {
			sent.push(event);
		},
	} as unknown as ChangeQueue;
	store = new ContentStore(models, { DB: db.DB, CONTENT_CHANGES: queue });
});
afterAll(() => db.dispose());

describe("shows write model", () => {
	it("accepts every stored show as it is", async () => {
		const page = await store.list("show", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		expect(page.value.rows.length).toBeGreaterThan(0);
		for (const row of page.value.rows) {
			const result = await store.update(
				"show",
				String(row.id),
				{},
				{ ifVersion: 0 },
				agent,
			);
			if (!result.ok) {
				throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			}
			const { updatedAt: _a, descriptionDoc: _b, ...before } = row;
			const { updatedAt: _c, descriptionDoc, ...after } = result.value.value;
			expect(after).toEqual(before);
			// Shows not backfilled yet get their document from the Markdown.
			expect(descriptionDoc).toEqual(documentFromMarkdown(String(row.description)));
		}
	});

	it("keeps every backfilled description identical to its Markdown copy", async () => {
		const page = await store.list("show", { limit: 200 });
		if (!page.ok) throw new Error(page.error.message);
		for (const row of page.value.rows) {
			const current = await store.get("show", String(row.id));
			if (!current.ok) throw new Error(current.error.message);
			const result = await store.update(
				"show",
				String(row.id),
				{ descriptionDoc: documentFromMarkdown(String(row.description)) },
				{ ifVersion: current.value.version },
				agent,
			);
			if (!result.ok) throw new Error(`${row.id}: ${JSON.stringify(result.error)}`);
			expect(result.value.value.description).toBe(row.description);
		}
	});

	it("creates a show and tags its page", async () => {
		const created = await store.create(
			"show",
			{
				id: "debug-club",
				name: "Debug Club",
				descriptionDoc: doc,
				status: "coming-soon",
				gameFormatUrl: "https://play.rawkode.academy/games/debug-club",
				podcast: {
					email: "team@rawkode.academy",
					category: "Technology",
					explicit: false,
				},
				subscribeLinks: [
					{ platform: "RSS", url: "https://rawkode.academy/feeds/debug-club.xml", icon: "rss" },
				],
			},
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({
			description: "Break it, then **fix it**.",
			published: false,
			tagline: null,
			coverUrl: null,
		});
		expect(sent.at(-1)).toMatchObject({
			model: "show",
			id: "debug-club",
			operation: "create",
			tags: ["shows:debug-club"],
		});
	});

	it("builds descriptionDoc from Markdown when a writer sends only a description", async () => {
		const created = await store.create(
			"show",
			{ id: "markdown-only", name: "Markdown only", description: "A *weekly* show." },
			agent,
		);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value.descriptionDoc).toMatchObject({ type: "doc" });
		expect(created.value.value.description).toBe("A *weekly* show.");
		expect(created.value.value.status).toBe("active");
	});

	it("leaves both copies empty when there is no description", async () => {
		const created = await store.create("show", { id: "quiet", name: "Quiet" }, agent);
		if (!created.ok) throw new Error(JSON.stringify(created.error));
		expect(created.value.value).toMatchObject({ description: null, descriptionDoc: null });
	});

	it("clears the Markdown copy when the document is emptied", async () => {
		const updated = await store.update(
			"show",
			"markdown-only",
			{ descriptionDoc: { type: "doc", content: [{ type: "paragraph" }] } },
			{ ifVersion: 1 },
			agent,
		);
		if (!updated.ok) throw new Error(JSON.stringify(updated.error));
		expect(updated.value.value).toMatchObject({ description: null, descriptionDoc: null });
	});

	it("rejects values the website cannot render", async () => {
		const result = await store.create(
			"show",
			{
				id: "Not A Slug",
				name: " ",
				status: "coming_soon",
				gameFormatUrl: "http://play.rawkode.academy/games/x",
				coverUrl: "cover.png",
				coverWidth: -1,
				podcast: { email: "nope", category: "Technology", explicit: "no" },
				subscribeLinks: [{ platform: "Mastodon", url: "https://x.y", icon: "mastodon" }],
			},
			agent,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.issues?.map((i) => i.path).sort()).toEqual(
			[
				"coverUrl",
				"coverWidth",
				"gameFormatUrl",
				"id",
				"name",
				"podcast.email",
				"podcast.explicit",
				"status",
				"subscribeLinks.0.icon",
			].sort(),
		);
	});

	it("rejects a document the website cannot render", async () => {
		const result = await store.create(
			"show",
			{
				id: "bad-doc",
				name: "Bad doc",
				descriptionDoc: { type: "doc", content: [{ type: "marquee" }] },
			},
			agent,
		);
		expect(!result.ok && result.error.issues?.[0]?.path).toBe("descriptionDoc");
	});
});
