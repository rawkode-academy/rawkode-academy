import type { BlockNode, DocNode, InlineNode } from "@rawkodeacademy/rich-text";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetContentCacheForTests } from "@/lib/live-content/kv-cache";
import {
	autolinkTechnologies,
	buildTechnologyLookup,
} from "@/lib/live-content/render/autolink";
import {
	prepareInlineSvg,
	resetDiagramCacheForTests,
	themeSvgForToggle,
} from "@/lib/live-content/render/diagram";
import { splitIslands, stripIslands } from "@/lib/live-content/render/islands";
import {
	extractHeadings,
	isExternalHref,
	renderDocument,
	renderDocumentUncached,
	renderEntry,
	resetRenderCacheForTests,
} from "@/lib/live-content/render/render";
import { educate, smartypants } from "@/lib/live-content/render/typography";
import { memoryKv } from "./memory-kv";

// biome-ignore lint/suspicious/noExplicitAny: test marks
const text = (value: string, marks?: any[]): InlineNode =>
	marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const p = (...content: InlineNode[]): BlockNode => ({
	type: "paragraph",
	content,
});
const doc = (...content: BlockNode[]): DocNode => ({ type: "doc", content });
const link = (href: string) => ({
	type: "link" as const,
	attrs: { href, target: null, rel: null, class: null, title: null },
});

const technologies = buildTechnologyLookup([
	{ id: "kubernetes", name: "Kubernetes" },
	{ id: "docker", name: "Docker" },
	{ id: "go", name: "Go" },
	{ id: "fleet", name: "Fleet" },
	{ id: "cert-manager", name: "cert-manager" },
]);

beforeEach(() => {
	resetContentCacheForTests();
	resetRenderCacheForTests();
	resetDiagramCacheForTests();
});

describe("smartypants typography", () => {
	it("curls quotes, apostrophes, dashes and ellipses", () => {
		expect(educate("\"Hello\" -- it's 'quoted'... ``old'' '90s", "")).toBe(
			"“Hello” — it’s ‘quoted’… “old” ’90s",
		);
		expect(educate("a---b", "")).toBe("a—b");
	});

	it("leaves code marks and code blocks alone and looks across text nodes", () => {
		const result = smartypants(
			doc(
				p(
					text('He said "'),
					text("bold", [{ type: "bold" }]),
					text('" and '),
					text('"x" -- y', [{ type: "code" }]),
				),
				{
					type: "codeBlock",
					attrs: { language: "sh", title: null, meta: null },
					content: [{ type: "text", text: 'echo "--x"' }],
				},
			),
		);
		const para = result.content[0] as { content: { text: string }[] };
		expect(para.content.map((n) => n.text)).toEqual([
			"He said “",
			"bold",
			"” and ",
			'"x" -- y',
		]);
		expect(
			(result.content[1] as { content: { text: string }[] }).content[0]!.text,
		).toBe('echo "--x"');
	});
});

describe("technology autolinking", () => {
	it("links the first plain mention of each technology only", () => {
		const out = autolinkTechnologies(
			doc(
				p(text("Kubernetes runs Docker. Kubernetes again, and docker.")),
				p(text("More Kubernetes.")),
			),
			technologies,
		);
		const nodes = (
			out.content[0] as {
				content: { text: string; marks?: { attrs?: { href: string } }[] }[];
			}
		).content;
		expect(nodes.map((n) => [n.text, n.marks?.[0]?.attrs?.href])).toEqual([
			["Kubernetes", "/technology/kubernetes"],
			[" runs ", undefined],
			["Docker", "/technology/docker"],
			[". Kubernetes again, and docker.", undefined],
		]);
		expect(
			(out.content[1] as { content: { marks?: unknown }[] }).content[0]!.marks,
		).toBeUndefined();
	});

	it("skips headings, links, code, asides and short or ambiguous names", () => {
		const out = autolinkTechnologies(
			doc(
				{
					type: "heading",
					attrs: { level: 2, id: "k" },
					content: [text("Kubernetes")],
				},
				{
					type: "aside",
					attrs: { variant: "tip" },
					content: [p(text("Kubernetes in an aside"))],
				},
				p(
					text("Kubernetes", [link("https://k8s.io")]),
					text(" "),
					text("Kubernetes", [{ type: "code" }]),
				),
				p(
					text(
						"Go and Fleet are skipped; cert-manager is linked once in Kubernetes-native setups.",
					),
				),
			),
			technologies,
		);
		const html = JSON.stringify(out);
		expect(html).not.toContain('"/technology/go"');
		expect(html).not.toContain('"/technology/fleet"');
		expect(html).toContain('"/technology/cert-manager"');
		// "Kubernetes-native" is not a whole-word mention.
		expect(html).not.toContain('"/technology/kubernetes"');
	});

	it("does not self-link on a technology's own profile", () => {
		const out = autolinkTechnologies(
			doc(p(text("Kubernetes and Docker"))),
			technologies,
			{
				skipIds: ["kubernetes/index"],
			},
		);
		const hrefs = JSON.stringify(out).match(/\/technology\/[a-z-]+/g);
		expect(hrefs).toEqual(["/technology/docker"]);
	});
});

describe("renderDocument hooks", () => {
	const render = (d: DocNode, options = {}) =>
		renderDocumentUncached(d, { highlight: false, ...options }, technologies);

	it("opens absolute http(s) links in a new tab, like rehype-external-links", async () => {
		const { html } = await render(
			doc(
				p(
					text("ext", [link("https://example.com/a?b=1&c")]),
					text(" "),
					text("int", [link("/watch/x")]),
				),
			),
		);
		expect(html).toContain(
			'<a href="https://example.com/a?b=1&amp;c" target="_blank" rel="nofollow noopener">ext</a>',
		);
		expect(html).toContain('<a href="/watch/x">int</a>');
		expect(isExternalHref("mailto:x@y")).toBe(false);
	});

	it("keeps descriptions marked-style: no typography, autolinks or new tabs", async () => {
		const { html } = await render(
			doc(p(text('"Kubernetes" -- '), text("x", [link("https://e.com")]))),
			{
				profile: "description",
			},
		);
		expect(html).toBe(
			'<p>&quot;Kubernetes&quot; -- <a href="https://e.com">x</a></p>',
		);
	});

	it("renders asides with the site's Aside markup", async () => {
		const { html } = await render(
			doc({
				type: "aside",
				attrs: { variant: "warning" },
				content: [p(text("Careful"))],
			}),
		);
		expect(html).toMatch(
			/^<aside class="[^"]+" aria-label="warning"><div class="[^"]+"><svg /,
		);
		expect(html).toContain(">warning</span>");
		expect(html).toContain("<p>Careful</p></div></aside>");
	});

	it("inlines diagram SVGs with the Diagram markup and caches them in KV", async () => {
		const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#fff}@media screen and (prefers-color-scheme:dark){.d2-1 .fill-N1{fill:#000;}.b,.c{stroke:red}}</style><rect/></svg>`;
		const fetchMock = vi.fn(async () => new Response(svg, { status: 200 }));
		const kv = memoryKv();
		const diagram: BlockNode = {
			type: "diagram",
			attrs: {
				id: "arch",
				title: "Architecture",
				description: "How it fits",
				language: "d2",
				source: "a -> b",
				meta: "sketch",
				src: "https://content.rawkode.academy/articles/x/diagrams/abc.svg",
			},
		};
		const { html } = await render(doc(diagram), { fetch: fetchMock, kv });
		expect(html).toContain('aria-labelledby="arch-caption"');
		expect(html).toContain('<figcaption class="');
		expect(html).toContain("Enlarge diagram");
		expect(html).toContain(":root.dark .d2-1 .fill-N1{fill:#000;}");
		expect(html).toContain(":root.dark .b,:root.dark .c{stroke:red}");
		expect(html).not.toContain("prefers-color-scheme");
		expect(html).not.toContain("<?xml");
		expect([...kv.store.keys()].some((k) => k.startsWith("diagram:v1:"))).toBe(
			true,
		);

		resetDiagramCacheForTests();
		await render(doc(diagram), { fetch: fetchMock, kv });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("falls back to an <img>, then to the d2 source, when the SVG is unavailable", async () => {
		const failing = vi.fn(async () => new Response("nope", { status: 404 }));
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const base = {
			id: null,
			title: null,
			description: null,
			language: "d2" as const,
			source: "a -> b",
			meta: null,
		};
		const withSrc = await render(
			doc({ type: "diagram", attrs: { ...base, src: "https://c/x.svg" } }),
			{ fetch: failing },
		);
		expect(withSrc.html).toContain('<img src="https://c/x.svg"');
		const noSrc = await render(
			doc({ type: "diagram", attrs: { ...base, src: null } }),
		);
		expect(noSrc.html).toContain(
			'<pre><code class="language-d2">a -&gt; b</code></pre>',
		);
	});

	it("renders theme-aware images with toggle-controlled classes", async () => {
		const { html } = await render(
			doc({
				type: "image",
				attrs: {
					src: "https://c/l.png",
					alt: "Shot",
					title: null,
					width: 800,
					height: 600,
					darkSrc: "https://c/d.png",
					zoomable: false,
				},
			}),
		);
		expect(html).toContain(
			'<div class="theme-aware-image"><img src="https://c/l.png" alt="Shot" width="800" height="600" class="theme-light-only"',
		);
		expect(html).toContain('class="theme-dark-only"');
		expect(html).not.toContain("prefers-color-scheme");
	});

	it("leaves island placeholders (with static fallbacks) for videos, zoomable images and interactive components", async () => {
		const { html } = await render(
			doc(
				{ type: "video", attrs: { videoId: "abc", thumbnailUrl: null } },
				{
					type: "image",
					attrs: {
						src: "https://c/z.png",
						alt: "Zoom",
						title: null,
						width: null,
						height: null,
						darkSrc: null,
						zoomable: true,
					},
				},
				{
					type: "interactive",
					attrs: { component: "CgroupTimeline", props: {}, hydrate: "visible" },
				},
			),
		);
		const islands = splitIslands(html).filter((s) => s.kind === "island");
		expect(
			islands.map((s) => s.kind === "island" && [s.component, s.hydrate]),
		).toEqual([
			["VideoPlayer", "only"],
			["ZoomableImage", "only"],
			["CgroupTimeline", "visible"],
		]);
		expect(islands[0]).toMatchObject({
			props: {
				video: "abc",
				thumbnailUrl:
					"https://content.rawkode.academy/videos/abc/thumbnail.webp",
			},
		});
		expect(stripIslands(html)).toContain(
			'<img src="https://c/z.png" alt="Zoom"',
		);
		expect(stripIslands(html)).not.toContain("rt-island");
	});

	it("applies typography and autolinks in prose", async () => {
		const { html, headings } = await render(
			doc(
				{
					type: "heading",
					attrs: { level: 2, id: "intro" },
					content: [text('Why "Kubernetes"?')],
				},
				p(text("Kubernetes isn't hard...")),
			),
		);
		expect(html).toContain('<h2 id="intro">Why “Kubernetes”?</h2>');
		expect(html).toContain(
			'<p><a href="/technology/kubernetes">Kubernetes</a> isn’t hard…</p>',
		);
		expect(headings).toEqual([
			{ depth: 2, slug: "intro", text: "Why “Kubernetes”?" },
		]);
	});

	it("highlights code with Expressive Code and ships its styles once", async () => {
		const { html } = await renderDocumentUncached(
			doc(
				{
					type: "codeBlock",
					attrs: { language: "bash", title: "Terminal", meta: null },
					content: [{ type: "text", text: "kubectl get pods" }],
				},
				{
					type: "codeBlock",
					attrs: { language: "rust", title: null, meta: "{1}" },
					content: [{ type: "text", text: "fn main() {}" }],
				},
			),
			{},
			technologies,
		);
		expect(html.match(/<div class="expressive-code">/g)).toHaveLength(2);
		expect(html).toContain('<figure class="frame is-terminal has-title">');
		expect(html).toContain('<span class="title">Terminal</span>');
		expect(html).toContain("ec-line highlight mark");
		expect(html.match(/<style>/g)).toHaveLength(1);
		expect(html).toContain('<script type="module">');
	}, 30_000);

	it("highlights cue fences with the bundled CUE grammar", async () => {
		const { html } = await renderDocumentUncached(
			doc({
				type: "codeBlock",
				attrs: { language: "cue", title: null, meta: null },
				content: [{ type: "text", text: 'package cuenv\nimport "x"' }],
			}),
			{},
			technologies,
		);
		expect(html).not.toContain(">package cuenv<");
		expect(html).toMatch(/>package<\/span>/);
	}, 30_000);

	it("expands tabs to two spaces like rehype-expressive-code", async () => {
		const { html } = await renderDocumentUncached(
			doc({
				type: "codeBlock",
				attrs: { language: null, title: null, meta: null },
				content: [{ type: "text", text: "a {\n\tb\n}" }],
			}),
			{},
			technologies,
		);
		expect(html).not.toContain("\t");
		expect(html).toContain("a {\u007f  b\u007f}");
	}, 30_000);
});

describe("renderDocument caching", () => {
	it("caches rendered HTML in KV by document hash", async () => {
		const kv = memoryKv();
		const d = doc(p(text("Hello")));
		const first = await renderDocument(d, {
			kv,
			technologies,
			highlight: false,
		});
		expect(first.html).toBe("<p>Hello</p>");
		const key = [...kv.store.keys()].find((k) => k.startsWith("render:v2:"));
		expect(key).toBeDefined();
		resetRenderCacheForTests();
		kv.store.set(
			key!,
			JSON.stringify({ html: "<p>from kv</p>", headings: [] }),
		);
		expect(
			(await renderDocument(d, { kv, technologies, highlight: false })).html,
		).toBe("<p>from kv</p>");
		// A different document is a different key.
		expect(
			(
				await renderDocument(doc(p(text("Other"))), {
					kv,
					technologies,
					highlight: false,
				})
			).html,
		).toBe("<p>Other</p>");
	});

	it("does not autolink technology profiles, as remark-tech-autolink skipped them", async () => {
		const body = doc(p(text("Kubernetes and Docker")));
		const entry = (collection: "technologies" | "articles") =>
			({ id: "kubernetes", collection, data: { body } }) as never;
		const opts = { kv: memoryKv(), technologies, highlight: false };
		expect((await renderEntry(entry("technologies"), opts)).html).toBe(
			"<p>Kubernetes and Docker</p>",
		);
		expect((await renderEntry(entry("articles"), opts)).html).toContain(
			'"/technology/docker"',
		);
	});

	it("returns empty output for empty documents", async () => {
		expect(
			await renderDocument(doc({ type: "paragraph" }), {
				kv: memoryKv(),
				technologies,
			}),
		).toEqual({ html: "", headings: [] });
		expect(await renderDocument(undefined)).toEqual({ html: "", headings: [] });
	});
});

describe("helpers", () => {
	it("extracts headings like Astro's render()", () => {
		expect(
			extractHeadings(
				'<h2 id="a-b">A &amp; <code>B</code></h2><h3 id="c">C</h3>',
			),
		).toEqual([
			{ depth: 2, slug: "a-b", text: "A & B" },
			{ depth: 3, slug: "c", text: "C" },
		]);
	});

	it("prepares SVG for inlining", () => {
		expect(prepareInlineSvg("not svg")).toBeUndefined();
		expect(
			prepareInlineSvg(
				'<svg><image href="data:image/png;base64,AA"/><a href="#n"/></svg>',
			),
		).toBe('<svg><image href="data:image/png;base64,AA"/><a href="#n"/></svg>');
		expect(
			themeSvgForToggle(
				"<style>@media (prefers-color-scheme: dark){.x{a:b}}</style>",
			),
		).toBe("<style>:root.dark .x{a:b}</style>");
	});

	it.each([
		"<svg><script>alert(1)</script></svg>",
		"<svg><script >alert(1)</script ></svg>",
		"<svg><scr<script>ipt>alert(1)</script></svg>",
		"<svg><rect onclick=alert(1) /></svg>",
		'<svg><rect\nonload="alert(1)"/></svg>',
		"<svg><foreignObject><div/></foreignObject></svg>",
		'<svg><a href="javascript:alert(1)"/></svg>',
		'<svg><a xlink:href=" javascript:alert(1)"/></svg>',
		'<svg><a href="java&#x73;cript:alert(1)"/></svg>',
		'<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
	])("refuses to inline SVG with active content: %s", (svg) => {
		expect(prepareInlineSvg(svg)).toBeUndefined();
	});
});
