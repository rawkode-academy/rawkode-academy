import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	// Round-trip through JSON like the wire does, so DateTimes compare as strings.
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("articles read model", () => {
	it("lists every article, newest first, ties broken by id", async () => {
		const { allArticles } = await query("{ allArticles { id publishedAt } }");
		expect(allArticles.map((a: { id: string }) => a.id)).toEqual([
			"klustered-winter-2026",
			"your-guide-to-kubernetes-dra",
			"kyverno-cel-validating-policy",
			"zed-show-and-tell",
			"how-to-ask-for-help",
		]);
	});

	it("serves frontmatter fields, with revisedAt apart from updatedAt", async () => {
		const { articleById } =
			await query(`{ articleById(id: "how-to-ask-for-help") {
			id slug title subtitle description type howto draft series categories tags
			openGraph { title subtitle } cover { url } updates { date } resources { title }
			publishedAt revisedAt updatedAt authors { id } technologies { id } } }`);
		expect(articleById).toMatchObject({
			id: "how-to-ask-for-help",
			slug: "how-to-ask-for-help",
			title: "How to ask for help",
			subtitle: null,
			description:
				"Master the art of asking technical questions that get helpful responses",
			type: "guide",
			howto: true,
			draft: false,
			series: null,
			categories: [],
			tags: [],
			openGraph: {
				title: "Need Help?",
				subtitle: "Learn to ask questions that people want to answer",
			},
			cover: null,
			updates: [],
			resources: [],
			publishedAt: "2023-10-31T00:00:00.000Z",
			revisedAt: "2023-11-10T00:00:00.000Z",
			authors: [{ id: "russellwaite" }],
			technologies: [{ id: "kubernetes" }],
		});
		expect(Date.parse(articleById.updatedAt)).not.toBeNaN();
	});

	it("derives revisedAt from the latest update when updatedAt is unset", async () => {
		const { articleById } =
			await query(`{ articleById(id: "kyverno-cel-validating-policy") {
			revisedAt updates { date description } technologies { id } } }`);
		expect(articleById.revisedAt).toBe("2025-06-04T00:00:00.000Z");
		expect(articleById.updates).toEqual([
			{
				date: "2025-06-04T00:00:00.000Z",
				description:
					"Claude article review changed policies for the worst. This has been corrected",
			},
		]);
		expect(articleById.technologies).toEqual([
			{ id: "kyverno" },
			{ id: "kubernetes" },
		]);
	});

	it("applies the website's defaults", async () => {
		const { articleById } =
			await query(`{ articleById(id: "your-guide-to-kubernetes-dra") {
			type howto draft cover { url } openGraph { title } revisedAt } }`);
		expect(articleById).toEqual({
			type: "tutorial",
			howto: false,
			draft: false,
			cover: null,
			openGraph: null,
			revisedAt: null,
		});
	});

	it("serves the body as a TipTap document with CDN assets", async () => {
		const { zed, help } = await query(`{
			zed: articleById(id: "zed-show-and-tell") { cover { url alt width height } body authors { id } }
			help: articleById(id: "how-to-ask-for-help") { body } }`);
		expect(zed.cover).toEqual({
			url: "https://content.rawkode.academy/articles/zed-show-and-tell/zed-show-and-tell-cover.png",
			alt: "zed website",
			width: 1574,
			height: 769,
		});
		expect(zed.authors).toEqual([{ id: "icepuma" }]);
		expect(zed.body.type).toBe("doc");
		expect(
			zed.body.content.find((n: { type: string }) => n.type === "image"),
		).toEqual({
			type: "image",
			attrs: {
				src: "https://content.rawkode.academy/articles/zed-show-and-tell/zed-show-and-tell-01.png",
				alt: "Zed - empty window",
				title: null,
				width: 2672,
				height: 1420,
				darkSrc: null,
				zoomable: true,
			},
		});
		expect(
			help.body.content.find((n: { type: string }) => n.type === "heading"),
		).toEqual({
			type: "heading",
			attrs: { level: 2, id: "make-it-easy-to-read" },
			content: [{ type: "text", text: "Make it Easy to Read" }],
		});
	});

	it("returns drafts with their flag, and null for unknown ids", async () => {
		await db.DB.prepare(
			"UPDATE articles SET draft = 1 WHERE id = 'klustered-winter-2026'",
		).run();
		const { allArticles, missing } = await query(`{
			allArticles { id draft }
			missing: articleById(id: "nope") { id } }`);
		expect(allArticles[0]).toEqual({
			id: "klustered-winter-2026",
			draft: true,
		});
		expect(allArticles).toHaveLength(5);
		expect(missing).toBeNull();
		await db.DB.prepare(
			"UPDATE articles SET draft = 0 WHERE id = 'klustered-winter-2026'",
		).run();
	});

	it("adds authoredArticles to Person and articles to Technology for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [
			{ __typename: "Person", id: "rawkode" },
			{ __typename: "Person", id: "icepuma" },
			{ __typename: "Technology", id: "kubernetes" }
		]) { ... on Person { authoredArticles { id } } ... on Technology { articles { id } } } }`);
		expect(_entities[0].authoredArticles).toEqual([
			{ id: "klustered-winter-2026" },
			{ id: "your-guide-to-kubernetes-dra" },
			{ id: "kyverno-cel-validating-policy" },
		]);
		expect(_entities[1].authoredArticles).toEqual([
			{ id: "zed-show-and-tell" },
		]);
		expect(_entities[2].articles.map((a: { id: string }) => a.id)).toEqual([
			"klustered-winter-2026",
			"your-guide-to-kubernetes-dra",
			"kyverno-cel-validating-policy",
			"how-to-ask-for-help",
		]);
	});

	it("resolves Article entities for the gateway", async () => {
		const { _entities } = await query(
			`{ _entities(representations: [{ __typename: "Article", id: "zed-show-and-tell" }]) { ... on Article { title } } }`,
		);
		expect(_entities).toEqual([{ title: "Zed: Show & Tell" }]);
	});
});
