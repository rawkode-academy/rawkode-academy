// Every fixture (a sample of the former content/ tree, see tests/fixtures) must
// convert, validate, round-trip through Markdown and render. A failure names
// the file.
import { afterAll, describe, expect, test } from "bun:test";
import { dirname, posix } from "node:path";
import GithubSlugger from "github-slugger";
import type { Nodes } from "mdast";
import { type DocNode, toHtml, toText } from "../src/index";
import { fromMarkdown, parseMarkdown, toMarkdown } from "../src/markdown/index";
import { validateDoc } from "../src/schema";
import { type CorpusEntry, loadCorpus } from "./corpus";

const corpus = loadCorpus();
const seenTypes = new Set<string>();
const counts = new Map<
	string,
	{ entries: number; nonEmpty: number; headings: number }
>();

const resolver = (entry: CorpusEntry) => (path: string) =>
	`https://content.rawkode.academy/${posix.normalize(posix.join(dirname(entry.file), path))}`;

function convert(entry: CorpusEntry, source = entry.source): DocNode {
	return fromMarkdown(source, {
		mdx: entry.mdx,
		file: entry.file,
		assetResolver: resolver(entry),
	});
}

// What Astro's heading-id plugin slugs: the heading's text content.
function headingText(node: Nodes): string {
	if (node.type === "text" || node.type === "inlineCode") return node.value;
	if ("children" in node)
		return (node.children as Nodes[]).map(headingText).join("");
	return "";
}

function sourceHeadingIds(entry: CorpusEntry): string[] {
	const slugger = new GithubSlugger();
	const ids: string[] = [];
	const visit = (node: Nodes) => {
		if (node.type === "heading") ids.push(slugger.slug(headingText(node)));
		if ("children" in node)
			for (const child of node.children as Nodes[]) visit(child);
	};
	visit(parseMarkdown(entry.source, entry.mdx));
	return ids;
}

function docHeadingIds(doc: DocNode): string[] {
	const ids: string[] = [];
	const visit = (node: {
		type: string;
		attrs?: { id?: string | null };
		content?: unknown[];
	}) => {
		if (node.type === "heading") ids.push(node.attrs?.id ?? "");
		for (const child of (node.content ?? []) as (typeof node)[]) visit(child);
	};
	visit(doc);
	return ids;
}

function collectTypes(node: {
	type: string;
	marks?: { type: string }[];
	content?: unknown[];
}) {
	seenTypes.add(node.type);
	for (const mark of node.marks ?? []) seenTypes.add(`mark:${mark.type}`);
	for (const child of (node.content ?? []) as (typeof node)[])
		collectTypes(child);
}

const collections = [...new Set(corpus.map((entry) => entry.collection))];

for (const collection of collections) {
	describe(collection, () => {
		for (const entry of corpus.filter((e) => e.collection === collection)) {
			test(`${entry.file} (${entry.field})`, () => {
				const doc = convert(entry);
				collectTypes(doc);

				// The JSON is canonical: ProseMirror reads and writes it unchanged.
				expect(validateDoc(doc).toJSON()).toEqual(doc);

				// Markdown is a faithful export: reading it back gives the same doc.
				const markdown = toMarkdown(doc, { mdx: entry.mdx });
				expect(convert(entry, markdown)).toEqual(doc);
				// Portable Markdown (YouTube, social) must at least parse as Markdown.
				fromMarkdown(toMarkdown(doc), { mdx: false, file: entry.file });

				const expectedIds = sourceHeadingIds(entry);
				expect(docHeadingIds(doc)).toEqual(expectedIds);

				const html = toHtml(doc);
				const text = toText(doc);
				const nonEmpty = entry.source.trim() !== "";
				if (nonEmpty) {
					expect(html.length).toBeGreaterThan(0);
					expect(text.length).toBeGreaterThan(0);
				}
				for (const id of expectedIds) expect(html).toContain(` id="${id}"`);

				const count = counts.get(collection) ?? {
					entries: 0,
					nonEmpty: 0,
					headings: 0,
				};
				count.entries++;
				if (nonEmpty) count.nonEmpty++;
				count.headings += expectedIds.length;
				counts.set(collection, count);
			});
		}
	});
}

// Keeps the fixture set honest: each custom node and less common construct
// must appear in at least one fixture.
test("fixtures cover every custom node", () => {
	for (const type of [
		"aside",
		"diagram",
		"image",
		"video",
		"interactive",
		"embed",
		"table",
		"tableHeader",
		"codeBlock",
		"taskList",
		"orderedList",
		"blockquote",
		"horizontalRule",
		"mark:kbd",
		"mark:superscript",
		"mark:link",
		"mark:code",
	])
		expect(seenTypes).toContain(type);
});

afterAll(() => {
	const rows = [...counts].map(([collection, c]) => ({ collection, ...c }));
	console.table(rows);
	console.log(
		`total converted: ${rows.reduce((sum, row) => sum + row.entries, 0)} of ${corpus.length}`,
	);
});
