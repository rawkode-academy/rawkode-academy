import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { loadFixtures, migratedD1 } from "./d1";

// The plain text of a rich-text document node.
type DocJson = { type: string; text?: string; content?: DocJson[] };
const plain = (node: DocJson): string =>
	node.text ?? (node.content ?? []).map(plain).join("");

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

// Runs a query and counts the statements it sends to D1.
const countStatements = async (source: string) => {
	let statements = 0;
	const DB = {
		prepare: (sql: string) => {
			statements++;
			return db.DB.prepare(sql);
		},
		batch: (batch: Parameters<D1Database["batch"]>[0]) => db.DB.batch(batch),
	} as unknown as D1Database;
	const result = await graphql({
		schema: getSchema({ DB }),
		source,
		contextValue: {},
	});
	if (result.errors) throw result.errors[0];
	return { data: result.data as Record<string, any>, statements };
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("news read model", () => {
	it("lists every story, newest first", async () => {
		const { allNewsStories } = await query(
			"{ allNewsStories { id publishedAt } }",
		);
		expect(allNewsStories.map((s: { id: string }) => s.id)).toEqual([
			"2026-09-18-gloo-interrupted-validation",
			"2026-06-01-cloud-native-ai-infra-digest",
			"kubernetes-1-36-sneak-peek",
			"kyverno-graduates-cncf",
		]);
	});

	it("serves date-only publishedAt as UTC midnight, the body as a document, and updatedAt", async () => {
		const { newsStoryById } =
			await query(`{ newsStoryById(id: "kyverno-graduates-cncf") {
			id slug title description body publishedAt updatedAt } }`);
		expect(newsStoryById).toMatchObject({
			id: "kyverno-graduates-cncf",
			slug: "kyverno-graduates-cncf",
			title: "Kyverno Graduates from CNCF — Policy-as-Code Goes Mainstream",
			publishedAt: "2026-03-24T00:00:00.000Z",
		});
		expect(newsStoryById.description).toContain("CNCF Graduated");
		expect(newsStoryById.body.type).toBe("doc");
		expect(plain(newsStoryById.body.content[0])).toStartWith(
			"Kyverno has reached CNCF Graduated status",
		);
		expect(newsStoryById.body.content[1]).toEqual({
			type: "heading",
			attrs: { level: 2, id: "what-graduation-actually-requires" },
			content: [{ type: "text", text: "What Graduation Actually Requires" }],
		});
		expect(Date.parse(newsStoryById.updatedAt)).not.toBeNaN();
	});

	it("finds a story by slug, and returns null for unknown ones", async () => {
		const { found, missing } = await query(`{
			found: newsStoryBySlug(slug: "kubernetes-1-36-sneak-peek") { id }
			missing: newsStoryBySlug(slug: "nope") { id } }`);
		expect(found).toEqual({ id: "kubernetes-1-36-sneak-peek" });
		expect(missing).toBeNull();
	});

	it("returns future-dated stories: the website filters by time", async () => {
		await db.DB.prepare(
			"UPDATE news_stories SET published_at = 4102444800000 WHERE id = 'kyverno-graduates-cncf'",
		).run();
		const { allNewsStories } = await query(
			"{ allNewsStories { id publishedAt } }",
		);
		expect(allNewsStories[0]).toEqual({
			id: "kyverno-graduates-cncf",
			publishedAt: "2100-01-01T00:00:00.000Z",
		});
		await db.DB.prepare(
			"UPDATE news_stories SET published_at = 1774310400000 WHERE id = 'kyverno-graduates-cncf'",
		).run();
	});

	it("references authors and technologies in order", async () => {
		const { gloo, digest } = await query(`{
			gloo: newsStoryById(id: "2026-09-18-gloo-interrupted-validation") { authors { id } technologies { id } }
			digest: newsStoryById(id: "2026-06-01-cloud-native-ai-infra-digest") { authors { id } technologies { id } } }`);
		expect(gloo).toEqual({
			authors: [{ id: "rawkode" }],
			technologies: [{ id: "kubernetes" }, { id: "envoy" }],
		});
		expect(digest).toEqual({ authors: [{ id: "rawkode" }], technologies: [] });
	});

	it("adds newsStories to Person and Technology for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [
			{ __typename: "Person", id: "rawkode" },
			{ __typename: "Technology", id: "kyverno" }
		]) { ... on Person { newsStories { id } } ... on Technology { newsStories { id } } } }`);
		expect(_entities[0].newsStories).toHaveLength(4);
		expect(_entities[0].newsStories[0].id).toBe(
			"2026-09-18-gloo-interrupted-validation",
		);
		expect(_entities[1].newsStories).toEqual([
			{ id: "kyverno-graduates-cncf" },
		]);
	});

	it("loads newsStories for a whole gateway batch in a fixed number of queries", async () => {
		const { allNewsStories } = await query(
			"{ allNewsStories { id authors { id } technologies { id } } }",
		);
		const storiesOf = (match: (story: any) => boolean) =>
			allNewsStories.filter(match).map((story: any) => ({ id: story.id }));
		const by = (key: "authors" | "technologies", id: string) =>
			storiesOf((story) =>
				story[key].some((ref: { id: string }) => ref.id === id),
			);

		const one = await countStatements(`{ _entities(representations: [
			{ __typename: "Person", id: "rawkode" },
			{ __typename: "Technology", id: "kyverno" }
		]) { ... on Person { newsStories { id } } ... on Technology { newsStories { id } } } }`);
		const many = await countStatements(`{ _entities(representations: [
			{ __typename: "Person", id: "rawkode" },
			{ __typename: "Person", id: "nobody" },
			{ __typename: "Technology", id: "kubernetes" },
			{ __typename: "Technology", id: "envoy" },
			{ __typename: "Technology", id: "kyverno" }
		]) { ... on Person { newsStories { id } } ... on Technology { newsStories { id } } } }`);

		expect(
			many.data._entities.map((e: { newsStories: unknown }) => e.newsStories),
		).toEqual([
			by("authors", "rawkode"),
			[],
			by("technologies", "kubernetes"),
			by("technologies", "envoy"),
			by("technologies", "kyverno"),
		]);
		expect(many.data._entities[2].newsStories).toHaveLength(3);
		expect(many.statements).toBe(one.statements);
	});

	it("resolves NewsStory entities for the gateway", async () => {
		const { _entities } = await query(
			`{ _entities(representations: [{ __typename: "NewsStory", id: "kyverno-graduates-cncf" }]) { ... on NewsStory { title } } }`,
		);
		expect(_entities).toEqual([
			{ title: "Kyverno Graduates from CNCF — Policy-as-Code Goes Mainstream" },
		]);
	});
});
