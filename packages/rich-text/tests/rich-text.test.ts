import { describe, expect, test } from "bun:test";
import {
	type DocNode,
	MARK_ORDER,
	safeUrl,
	toHtml,
	toHtmlAsync,
	toText,
} from "../src/index";
import { fromMarkdown, toMarkdown } from "../src/markdown/index";
import { schema, validateDoc } from "../src/schema";

const md = (source: string) =>
	fromMarkdown(source, { mdx: false, file: "test.md" });
const mdx = (
	source: string,
	options: Partial<Parameters<typeof fromMarkdown>[1]> = {},
) => fromMarkdown(source, { mdx: true, file: "test.mdx", ...options });

function roundTrip(doc: DocNode, isMdx: boolean) {
	validateDoc(doc);
	const again = fromMarkdown(toMarkdown(doc, { mdx: isMdx }), { mdx: isMdx });
	expect(again).toEqual(doc);
}

describe("schema", () => {
	test("mark order matches the TipTap schema", () => {
		expect(Object.keys(schema().marks)).toEqual([...MARK_ORDER]);
	});

	test("empty input is an empty paragraph", () => {
		const doc = md("");
		expect(doc).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
		validateDoc(doc);
	});

	test("rejects JSON that does not fit", () => {
		expect(() =>
			validateDoc({ type: "doc", content: [{ type: "listItem" }] }),
		).toThrow();
	});
});

describe("fromMarkdown", () => {
	test("heading ids follow github-slugger, duplicates included", () => {
		const doc = md("# Hello World\n\n## Hello World\n\n### `code` & *more*");
		expect(
			doc.content.map((block) =>
				block.type === "heading" ? block.attrs.id : null,
			),
		).toEqual(["hello-world", "hello-world-1", "code--more"]);
	});

	test("marks, links, lists and tables", () => {
		const doc = md(
			[
				'**bold _both_** ~~gone~~ [`code` link](https://x.dev "T")',
				"",
				"3. three",
				"4. four",
				"",
				"- [x] done",
				"- [ ] todo",
				"",
				"| a | b |",
				"| :- | -: |",
				"| 1 | 2 |",
			].join("\n"),
		);
		const [paragraph, ordered, tasks, table] = doc.content;
		expect(paragraph).toMatchObject({
			content: [
				{ text: "bold ", marks: [{ type: "bold" }] },
				{ text: "both", marks: [{ type: "bold" }, { type: "italic" }] },
				{ text: " " },
				{ text: "gone", marks: [{ type: "strike" }] },
				{ text: " " },
				{
					text: "code",
					marks: [
						{ type: "link", attrs: { href: "https://x.dev", title: "T" } },
						{ type: "code" },
					],
				},
				{ text: " link", marks: [{ type: "link" }] },
			],
		});
		expect(ordered).toMatchObject({ type: "orderedList", attrs: { start: 3 } });
		expect(tasks).toMatchObject({
			type: "taskList",
			content: [{ attrs: { checked: true } }, { attrs: { checked: false } }],
		});
		expect(table).toMatchObject({
			content: [
				{
					content: [
						{ type: "tableHeader", attrs: { align: "left" } },
						{ type: "tableHeader", attrs: { align: "right" } },
					],
				},
				{ content: [{ type: "tableCell" }, { type: "tableCell" }] },
			],
		});
		roundTrip(doc, false);
	});

	test("code block titles split from the rest of the meta", () => {
		const doc = md(
			'```ts title="src/x.ts" {1,3} frame="code"\nconst x = 1;\n```',
		);
		expect(doc.content[0]).toEqual({
			type: "codeBlock",
			attrs: { language: "ts", title: "src/x.ts", meta: '{1,3} frame="code"' },
			content: [{ type: "text", text: "const x = 1;" }],
		});
		roundTrip(doc, false);
	});

	test("inline HTML: sup/kbd become marks, non-HTML tags stay text", () => {
		const doc = md("Option<T> and <kbd>Ctrl</kbd> x<sup> [§](#r)</sup>");
		expect(doc.content[0]).toMatchObject({
			content: [
				{ text: "Option<T> and " },
				{ text: "Ctrl", marks: [{ type: "kbd" }] },
				{ text: " x" },
				{ text: " ", marks: [{ type: "superscript" }] },
				{ text: "§", marks: [{ type: "link" }, { type: "superscript" }] },
			],
		});
		expect(toHtml(doc)).toBe(
			'<p>Option&lt;T&gt; and <kbd>Ctrl</kbd> x<sup> <a href="#r">§</a></sup></p>',
		);
		roundTrip(doc, false);
	});

	test("MDX components become custom nodes", () => {
		const source = [
			'import Aside from "@/components/Aside.astro";',
			'import Diagram from "@/components/articles/Diagram.astro";',
			'import ThemeAwareImage from "@/components/common/ThemeAwareImage.astro";',
			'import ZoomableImage from "@/components/image/ZoomableImage.astro";',
			'import VideoPlayer from "@/components/video/player.vue";',
			'import CgroupTimeline from "@/components/articles/cgroups/CgroupTimeline";',
			'import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";',
			'import light from "./light.png";',
			"",
			'<Aside variant="tip">',
			"",
			"Some **advice**.",
			"",
			"</Aside>",
			"",
			'<Diagram id="d" title="T" description="D">',
			"",
			"```d2 sketch",
			"a -> b",
			"```",
			"",
			"</Diagram>",
			"",
			'<ThemeAwareImage lightSrc={light} darkSrc={import("./dark.png")} alt="Shot" class="x" />',
			"",
			'<ZoomableImage image={import("./zoom.png")} alt="Zoom" />',
			"",
			'<VideoPlayer client:only="vue" video="abc" thumbnailUrl={getVideoThumbnailUrl("abc")} />',
			"",
			"<CgroupTimeline client:visible />",
			"",
			'<iframe src="https://example.com/embed" width="560" height="315" allowfullscreen=""></iframe>',
			"",
			"Press <kbd>Tab</kbd>",
		].join("\n");
		const resolve = (path: string) =>
			`https://cdn.test/${path.replace("./", "")}`;
		const doc = mdx(source, {
			assetResolver: (path) => ({ src: resolve(path), width: 100, height: 50 }),
			diagramResolver: (diagram) => `https://cdn.test/${diagram.id}.svg`,
		});
		expect(doc.content).toEqual([
			{
				type: "aside",
				attrs: { variant: "tip" },
				content: [
					{
						type: "paragraph",
						content: [
							{ type: "text", text: "Some " },
							{ type: "text", text: "advice", marks: [{ type: "bold" }] },
							{ type: "text", text: "." },
						],
					},
				],
			},
			{
				type: "diagram",
				attrs: {
					id: "d",
					title: "T",
					description: "D",
					language: "d2",
					source: "a -> b",
					meta: "sketch",
					src: "https://cdn.test/d.svg",
				},
			},
			{
				type: "image",
				attrs: {
					src: "https://cdn.test/light.png",
					alt: "Shot",
					title: null,
					width: 100,
					height: 50,
					darkSrc: "https://cdn.test/dark.png",
					zoomable: false,
				},
			},
			{
				type: "image",
				attrs: {
					src: "https://cdn.test/zoom.png",
					alt: "Zoom",
					title: null,
					width: 100,
					height: 50,
					darkSrc: null,
					zoomable: true,
				},
			},
			{ type: "video", attrs: { videoId: "abc", thumbnailUrl: null } },
			{
				type: "interactive",
				attrs: { component: "CgroupTimeline", props: {}, hydrate: "visible" },
			},
			{
				type: "embed",
				attrs: {
					src: "https://example.com/embed",
					title: null,
					width: 560,
					height: 315,
					allow: null,
					allowFullscreen: true,
				},
			},
			{
				type: "paragraph",
				content: [
					{ type: "text", text: "Press " },
					{ type: "text", text: "Tab", marks: [{ type: "kbd" }] },
				],
			},
		]);
		validateDoc(doc);
		// Dimensions from the resolver are written back as props, so the
		// output (absolute URLs only) converts without a resolver.
		roundTrip(doc, true);
		expect(toMarkdown(doc)).toContain("> **Tip:**");
	});

	describe("unsupported constructs throw with file and position", () => {
		const cases: [string, string, boolean][] = [
			["footnotes", "Text[^1]\n\n[^1]: note", false],
			["HTML blocks", "<div>\nx\n</div>", false],
			["unknown inline HTML", "a <span>b</span>", false],
			["MDX expressions", "{1 + 1}", true],
			["unimported components", "<Foo />", true],
			["unknown imports", 'import X from "y";\n\n<X />', true],
			[
				"unknown props",
				'import Aside from "@/components/Aside.astro";\n\n<Aside variant="tip" label="x">\n\nx\n\n</Aside>',
				true,
			],
			["exports", "export const x = 1;", true],
			["images inside text", "see ![x](https://x/y.png) here", false],
			[
				"Diagram without d2",
				'import Diagram from "@/components/articles/Diagram.astro";\n\n<Diagram id="x" title="t" description="d">\n\ntext\n\n</Diagram>',
				true,
			],
			["relative assets without a resolver", "![x](./y.png)", false],
		];
		for (const [name, source, isMdx] of cases) {
			test(name, () => {
				expect(() =>
					fromMarkdown(source, { mdx: isMdx, file: "f.mdx" }),
				).toThrow(/^f\.mdx:\d+:\d+: /);
			});
		}
	});
});

describe("toHtml", () => {
	const doc = md("# Title\n\n```ts\nlet a = 1;\n```\n\n- one\n- two");

	test("default rendering", () => {
		expect(toHtml(doc)).toBe(
			'<h1 id="title">Title</h1><pre data-language="ts"><code class="language-ts">let a = 1;</code></pre><ul><li>one</li><li>two</li></ul>',
		);
	});

	test("hooks override nodes and marks, and may be async", async () => {
		const html = await toHtmlAsync(doc, {
			nodes: {
				codeBlock: async (node) =>
					`<x-code lang="${node.attrs.language}"></x-code>`,
				listItem: (_node, { children }) => `<li class="i">${children}</li>`,
				heading: () => undefined,
			},
		});
		expect(html).toBe(
			'<h1 id="title">Title</h1><x-code lang="ts"></x-code><ul><li class="i"><p>one</p></li><li class="i"><p>two</p></li></ul>',
		);
		expect(() => toHtml(doc, { nodes: { codeBlock: async () => "" } })).toThrow(
			/toHtmlAsync/,
		);
	});

	test("headings without stored ids get unique ones", () => {
		const html = toHtml({
			type: "doc",
			content: [
				{
					type: "heading",
					attrs: { level: 2, id: "intro" },
					content: [{ type: "text", text: "Intro" }],
				},
				{
					type: "heading",
					attrs: { level: 2, id: null },
					content: [{ type: "text", text: "Intro" }],
				},
			],
		});
		expect(html).toContain('id="intro-1"');
	});

	test("unsafe URLs are dropped", () => {
		expect(toHtml(md("[x](javascript:alert(1))"))).toBe("<p><a>x</a></p>");
	});
});

describe("toText", () => {
	test("plain text without markup", () => {
		expect(
			toText(md("# T\n\nSome **bold** [link](https://x).\n\n- a\n- b")),
		).toBe("T\n\nSome bold link.\n\na\nb");
	});
});

// Defects found by adversarial review; each case broke before its fix.
describe("regressions", () => {
	test("validateDoc rejects attribute values the website cannot render", () => {
		const block = (node: object) => ({ type: "doc", content: [node] });
		const bad = [
			{
				type: "aside",
				attrs: { variant: "note" },
				content: [{ type: "paragraph" }],
			},
			{
				type: "interactive",
				attrs: { component: "Unknown", props: {}, hydrate: "visible" },
			},
			{
				type: "interactive",
				attrs: { component: "CgroupTimeline", props: [], hydrate: "visible" },
			},
			{
				type: "interactive",
				attrs: { component: "CgroupTimeline", props: {}, hydrate: "never" },
			},
			{ type: "heading", attrs: { level: 7, id: null } },
			{ type: "heading", attrs: { level: 2, id: 3 } },
			{
				type: "orderedList",
				attrs: { start: "2", type: null },
				content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
			},
			{ type: "image", attrs: { src: null } },
			{ type: "video", attrs: { videoId: 1, thumbnailUrl: null } },
			{
				type: "paragraph",
				content: [
					{
						type: "text",
						text: "x",
						marks: [{ type: "link", attrs: { href: null } }],
					},
				],
			},
		];
		for (const node of bad)
			expect(() => validateDoc(block(node))).toThrow(RangeError);
	});

	test("script URLs hidden by tabs, newlines or control characters are dropped", () => {
		for (const url of [
			"java\tscript:alert(1)",
			"java\nscript:x",
			"\u0001javascript:x",
			" \tdata:text/html,x",
		]) {
			expect(safeUrl(url)).toBeNull();
		}
		expect(safeUrl("https://rawkode.academy/a\tb")).toBe(
			"https://rawkode.academy/a\tb",
		);
	});

	test("a tight item with a nested list keeps its text out of <p>", () => {
		expect(toHtml(md("- a\n  - b\n- c"))).toBe(
			"<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>",
		);
		// Loose items with several paragraphs still get them.
		expect(toHtml(md("- a\n\n  b"))).toBe("<ul><li><p>a</p><p>b</p></li></ul>");
	});

	test("an item starting with an image renders no empty paragraph", () => {
		expect(toHtml(md("- ![a](https://x.dev/a.png)\n- b"))).toBe(
			'<ul><li><img src="https://x.dev/a.png" alt="a" loading="lazy" decoding="async"></li><li>b</li></ul>',
		);
	});

	test("a line ending inside a code span is a space", () => {
		expect(md("`a\nb`")).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "a b", marks: [{ type: "code" }] }],
				},
			],
		});
	});

	test("breaks: soft line breaks become hard breaks, as marked does for videos", () => {
		const source = "Chapters\n00:00 Intro\n01:30 *Setup*";
		const doc = fromMarkdown(source, { mdx: false, breaks: true });
		expect(toHtml(doc)).toBe(
			"<p>Chapters<br>00:00 Intro<br>01:30 <em>Setup</em></p>",
		);
		expect(fromMarkdown(toMarkdown(doc), { mdx: false, breaks: true })).toEqual(
			doc,
		);
		expect(toHtml(md(source))).toBe(
			"<p>Chapters 00:00 Intro 01:30 <em>Setup</em></p>",
		);
	});

	test("a trailing hard break is not written as a literal backslash", () => {
		const doc: DocNode = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "a" }, { type: "hardBreak" }],
				},
			],
		};
		expect(md(toMarkdown(doc))).toEqual({
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
		});
	});

	test("a code title with both quote kinds fails instead of losing the title", () => {
		const doc: DocNode = {
			type: "doc",
			content: [
				{
					type: "codeBlock",
					attrs: { language: "ts", title: `a'b"c`, meta: null },
					content: [{ type: "text", text: "x" }],
				},
			],
		};
		expect(() => toMarkdown(doc)).toThrow(/both quote kinds/);
	});
});
