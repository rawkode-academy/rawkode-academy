import {
	assertEquals,
	assertStringIncludes,
	assertThrows,
} from "jsr:@std/assert@1.0.13";
import {
	collectTargets,
	CONTENT_TYPES,
	type ContentItem,
	extractUrls,
	fileId,
	parseContentTypes,
	refineCheck,
	renderReport,
	resolveUrl,
	spreadByHost,
	summarise,
} from "./content_links.ts";
import type { LinkCheck } from "./technology.ts";

const WEBSITE = "https://rawkode.academy";

const link = (href: string, label: string) => ({
	type: "text",
	text: label,
	marks: [{ type: "bold" }, { type: "link", attrs: { href, target: null } }],
});

const document = {
	type: "doc",
	content: [
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Read " },
				link("https://kubernetes.io/docs/", "the documentation"),
				link("#resource-4", "below"),
			],
		},
		{
			type: "bulletList",
			content: [{
				type: "listItem",
				content: [{
					type: "paragraph",
					content: [link("/technology/apko", "apko")],
				}],
			}],
		},
		{
			type: "image",
			attrs: {
				src: "https://content.rawkode.academy/articles/example/light.png",
				darkSrc: "https://content.rawkode.academy/articles/example/dark.png",
				alt: "https://not-a-link.example/",
				title: null,
			},
		},
		{
			type: "embed",
			attrs: { src: "https://www.youtube-nocookie.com/embed/abc", width: 560 },
		},
		{
			type: "diagram",
			attrs: { src: null, source: "a -> https://ignored.example" },
		},
		{ type: "video", attrs: { videoId: "abc", thumbnailUrl: null } },
		{ type: "interactive", attrs: { component: "Timeline", props: {} } },
	],
};

Deno.test("extractUrls finds link marks and URL-bearing node attributes", () => {
	assertEquals(extractUrls(document), [
		"https://kubernetes.io/docs/",
		"#resource-4",
		"/technology/apko",
		"https://content.rawkode.academy/articles/example/light.png",
		"https://content.rawkode.academy/articles/example/dark.png",
		"https://www.youtube-nocookie.com/embed/abc",
	]);
});

Deno.test("extractUrls accepts a document serialised as a string and ignores junk", () => {
	assertEquals(extractUrls(JSON.stringify(document)).length, 6);
	assertEquals(extractUrls(null), []);
	assertEquals(extractUrls("not json"), []);
	assertEquals(extractUrls({ type: "doc" }), []);
});

Deno.test("resolveUrl separates external, internal and non-links", () => {
	assertEquals(resolveUrl("https://kubernetes.io/docs/#pods", WEBSITE), {
		url: "https://kubernetes.io/docs/",
		internal: false,
	});
	assertEquals(resolveUrl("/technology/apko", WEBSITE), {
		url: "https://rawkode.academy/technology/apko",
		internal: true,
	});
	assertEquals(
		resolveUrl("https://content.rawkode.academy/a.png", WEBSITE)?.internal,
		true,
	);
	assertEquals(
		resolveUrl("https://notrawkode.academy/", WEBSITE)?.internal,
		false,
	);
	assertEquals(resolveUrl("#resource-4", WEBSITE), null);
	assertEquals(resolveUrl("mailto:hello@example.com", WEBSITE), null);
	assertEquals(resolveUrl("  ", WEBSITE), null);
});

Deno.test("every content type maps its rows to items with links", () => {
	const body = {
		type: "doc",
		content: [{
			type: "paragraph",
			content: [link("https://a.example/", "a")],
		}],
	};
	assertEquals(
		CONTENT_TYPES.articles.collect([{
			id: "one",
			source: [
				"---",
				'title: "One"',
				"resources:",
				"  - title: B",
				"    url: https://b.example/",
				"---",
				"",
				"Read [a](https://a.example/), not `[code](https://code.example/)`.",
				"",
				"```sh",
				"curl https://fenced.example/ # [x](https://fenced.example/)",
				"```",
				"",
				'<ThemeAwareImage lightSrc="https://light.example/a.png" darkSrc="https://dark.example/a.png" alt="A" />',
				"",
				"<https://auto.example/>",
			].join("\n"),
		}]),
		[{
			contentType: "articles",
			id: "one",
			title: "One",
			links: [
				{ url: "https://a.example/", field: "body" },
				{ url: "https://light.example/a.png", field: "body" },
				{ url: "https://dark.example/a.png", field: "body" },
				{ url: "https://auto.example/", field: "body" },
				{ url: "https://b.example/", field: "resources" },
			],
		}],
	);
	assertEquals(fileId("seccomp-kubernetes/index.mdx"), "seccomp-kubernetes");
	assertEquals(fileId("how-i-git.md"), "how-i-git");
	assertEquals(
		CONTENT_TYPES.technologies.collect([
			{ id: "acorn", name: "Acorn", body: null, learningResources: null },
			{
				id: "aembit",
				name: "Aembit",
				body,
				learningResources: {
					official: ["https://docs.aembit.io/"],
					community: [],
					tutorials: ["https://t.example/"],
				},
			},
		]).map((item) => item.links.map((entry) => entry.field)),
		[[], [
			"body",
			"learningResources.official",
			"learningResources.tutorials",
		]],
	);
	const courses = CONTENT_TYPES.courses.collect([{
		id: "course",
		title: "Course",
		body: null,
		resources: [],
		modules: [{
			id: "course/01-introduction",
			title: "Introduction",
			body,
			resources: [{ url: "https://c.example/" }],
		}],
	}]);
	assertEquals(
		courses.map((item) => [item.id, item.title, item.links.length]),
		[
			["course", "Course", 0],
			["course/01-introduction", "Course: Introduction", 2],
		],
	);
	for (const [name, contentType] of Object.entries(CONTENT_TYPES)) {
		assertEquals(contentType.collect([]), [], name);
	}
});

Deno.test("parseContentTypes defaults, de-duplicates and rejects unknown names", () => {
	assertEquals(parseContentTypes("").includes("technologies"), true);
	assertEquals(parseContentTypes(" news, articles ,news"), [
		"news",
		"articles",
	]);
	assertThrows(() => parseContentTypes("news,podcasts"), Error, "podcasts");
});

const items: ContentItem[] = [
	{
		contentType: "articles",
		id: "one",
		title: "One",
		links: [
			{ url: "https://dead.example/page#top", field: "body" },
			{ url: "https://dead.example/page", field: "body" },
			{ url: "http://moved.example/", field: "resources" },
			{ url: "/watch/something", field: "body" },
			{ url: "#resource-1", field: "body" },
		],
	},
	{
		contentType: "news",
		id: "two",
		title: "Two",
		links: [
			{ url: "https://dead.example/page", field: "body" },
			{ url: "https://alive.example/", field: "body" },
			{ url: "https://x.com/rawkode", field: "body" },
		],
	},
	{ contentType: "news", id: "three", title: "Three", links: [] },
];

Deno.test("collectTargets de-duplicates URLs and keeps every location", () => {
	const { targets, notLinks } = collectTargets(items, WEBSITE);
	assertEquals(notLinks, 1);
	assertEquals(targets.map((target) => target.url), [
		"https://dead.example/page",
		"http://moved.example/",
		"https://rawkode.academy/watch/something",
		"https://alive.example/",
		"https://x.com/rawkode",
	]);
	assertEquals(targets[0].locations, [
		{ contentType: "articles", id: "one", title: "One", field: "body" },
		{ contentType: "news", id: "two", title: "Two", field: "body" },
	]);
	assertEquals(targets[2].internal, true);
});

Deno.test("spreadByHost never queues one host back to back when it can avoid it", () => {
	const target = (url: string) => ({ url, internal: false, locations: [] });
	assertEquals(
		spreadByHost([
			target("https://a.example/1"),
			target("https://a.example/2"),
			target("https://a.example/3"),
			target("https://b.example/1"),
			target("https://c.example/1"),
		]).map((entry) => entry.url),
		[
			"https://a.example/1",
			"https://b.example/1",
			"https://c.example/1",
			"https://a.example/2",
			"https://a.example/3",
		],
	);
});

function audit() {
	const { targets, notLinks } = collectTargets(items, WEBSITE);
	const checks = new Map<string, LinkCheck>([
		["https://dead.example/page", { state: "broken", status: 404 }],
		["http://moved.example/", {
			state: "redirected",
			status: 200,
			finalUrl: "https://moved.example/new",
		}],
		["https://alive.example/", { state: "ok", status: 200 }],
		["https://x.com/rawkode", {
			state: "blocked",
			detail: "X does not answer automated requests",
		}],
	]);
	return summarise(
		{
			auditedAt: "2026-11-11T00:00:00.000Z",
			contentTypes: ["articles", "news"],
			maximumItems: 0,
			includeInternal: false,
			notLinks,
		},
		items,
		targets,
		checks,
	);
}

Deno.test("summarise counts every state and lists what is not alive", () => {
	const { summary, findings } = audit();
	assertEquals(
		{
			items: summary.items,
			itemsWithLinks: summary.itemsWithLinks,
			links: summary.links,
			uniqueUrls: summary.uniqueUrls,
			checked: summary.checked,
			internalSkipped: summary.internalSkipped,
			notLinks: summary.notLinks,
			ok: summary.ok,
			redirected: summary.redirected,
			broken: summary.broken,
			blocked: summary.blocked,
			error: summary.error,
		},
		{
			items: 3,
			itemsWithLinks: 2,
			links: 8,
			uniqueUrls: 5,
			checked: 4,
			internalSkipped: 1,
			notLinks: 1,
			ok: 1,
			redirected: 1,
			broken: 1,
			blocked: 1,
			error: 0,
		},
	);
	assertEquals(summary.byContentType, {
		articles: { items: 1, links: 5, broken: 1, redirected: 1 },
		news: { items: 2, links: 3, broken: 1, redirected: 0 },
	});
	assertEquals(findings.map((finding) => [finding.state, finding.url]), [
		["broken", "https://dead.example/page"],
		["redirected", "http://moved.example/"],
		["blocked", "https://x.com/rawkode"],
	]);
	assertEquals(findings[0].locations.length, 2);
});

Deno.test("renderReport groups findings by content item", () => {
	const { summary, findings } = audit();
	const markdown = renderReport(summary, findings);
	assertStringIncludes(markdown, "| 8 | 5 | 4 | 1 | 1 | 1 | 1 | 0 |");
	assertStringIncludes(
		markdown,
		"### One (`articles/one`)\n\n- `body`: <https://dead.example/page> (404)",
	);
	assertStringIncludes(markdown, "### Two (`news/two`)");
	assertStringIncludes(
		markdown,
		"- `resources`: <http://moved.example/> now answers at <https://moved.example/new>",
	);
	assertStringIncludes(
		markdown,
		"<https://x.com/rawkode>: X does not answer automated requests in `news/two`",
	);
	assertStringIncludes(
		markdown,
		"Links to the website itself, not checked: 1.",
	);
	assertStringIncludes(
		renderReport({ ...summary, broken: 0 }, []),
		"No broken links.",
	);
});

Deno.test("refineCheck treats a redirect to a sign-in page as unverifiable", () => {
	assertEquals(
		refineCheck({
			state: "redirected",
			status: 200,
			finalUrl:
				"https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fa%2Fb%2Fissues%2Fnew",
		}),
		{ state: "blocked", status: 200, detail: "Requires signing in" },
	);
	const moved: LinkCheck = {
		state: "redirected",
		status: 200,
		finalUrl: "https://example.dev/docs/login-flows",
	};
	assertEquals(refineCheck(moved), moved);
	assertEquals(refineCheck({ state: "ok", status: 200 }), {
		state: "ok",
		status: 200,
	});
});
