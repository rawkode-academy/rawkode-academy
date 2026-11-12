import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
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
	// Round-trip through JSON so DateTime values look as they do on the wire.
	return JSON.parse(JSON.stringify(result.data)) as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("changelog read model", () => {
	it("lists every entry, newest first", async () => {
		const { allChangelogEntries } = await query(
			"{ allChangelogEntries { id date } }",
		);
		expect(allChangelogEntries.map((e: { id: string }) => e.id)).toEqual([
			"2026-05-24-site-redesign-and-sharing",
			"2025-09-30-enhanced-shows-pages",
			"2025-05-25-changelog",
			"2025-05-25-command-palette",
		]);
		expect(allChangelogEntries[0].date).toBe("2026-05-24T12:00:00.000Z");
	});

	it("serves every field of an entry", async () => {
		const { changelogEntryById } =
			await query(`{ changelogEntryById(id: "2025-09-30-enhanced-shows-pages") {
			id title date type description pullRequest author { id } body updatedAt } }`);
		expect(changelogEntryById).toMatchObject({
			id: "2025-09-30-enhanced-shows-pages",
			title: "📺 Improvement: Enhanced Shows Pages",
			date: "2025-09-30T16:30:00.000Z",
			type: "improvement",
			pullRequest: null,
			author: { id: "rawkode" },
		});
		// Both are documents: the Markdown's "**What's New:**" is a bold mark.
		const whatsNew = {
			type: "paragraph",
			content: [
				{ type: "text", text: "What's New:", marks: [{ type: "bold" }] },
			],
		};
		expect(changelogEntryById.description.type).toBe("doc");
		expect(changelogEntryById.description.content[1]).toEqual(whatsNew);
		expect(changelogEntryById.body.content).toContainEqual(whatsNew);
		expect(plain(changelogEntryById.description)).toStartWith(
			"Discover your favorite shows with a beautiful new design",
		);
		expect(new Date(changelogEntryById.updatedAt).toISOString()).toBe(
			changelogEntryById.updatedAt,
		);
	});

	it("serves a pull request number and a null updatedAt", async () => {
		await db.DB.prepare(
			"UPDATE changelog_entries SET pull_request = 1140, updated_at = NULL WHERE id = '2026-05-24-site-redesign-and-sharing'",
		).run();
		const { changelogEntryById } = await query(
			`{ changelogEntryById(id: "2026-05-24-site-redesign-and-sharing") { pullRequest updatedAt } }`,
		);
		expect(changelogEntryById).toEqual({ pullRequest: 1140, updatedAt: null });
	});

	it("serves a missing body as null", async () => {
		await db.DB.prepare(
			"UPDATE changelog_entries SET body = NULL WHERE id = '2025-05-25-changelog'",
		).run();
		const { changelogEntryById } = await query(
			`{ changelogEntryById(id: "2025-05-25-changelog") { body } }`,
		);
		expect(changelogEntryById).toEqual({ body: null });
	});

	it("returns null for an unknown entry", async () => {
		const { changelogEntryById } = await query(
			`{ changelogEntryById(id: "nope") { id } }`,
		);
		expect(changelogEntryById).toBeNull();
	});

	it("resolves ChangelogEntry entities for the gateway", async () => {
		const { _entities } = await query(
			`{ _entities(representations: [{ __typename: "ChangelogEntry", id: "2025-05-25-changelog" }]) { ... on ChangelogEntry { title author { id } } } }`,
		);
		expect(_entities).toEqual([
			{ title: "🎉 New Feature: Changelog", author: { id: "rawkode" } },
		]);
	});
});
