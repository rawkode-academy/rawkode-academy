import { readFileSync } from "node:fs";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as astroRuntime from "astro/runtime/server/index.js";
import ts from "typescript";
import { academyWatch } from "@rawkodeacademy/design-system";
import VideoContentTabs from "../components/video/video-content-tabs.vue";
import * as transcriptContent from "../components/video/transcript-content";
import {
	formatTranscriptTimestamp,
	normalizeTranscriptCues,
	transcriptSections,
	transcriptTextParts,
} from "../components/video/transcript-content";

vi.mock("../components/video/comments.vue", () => ({
	default: { template: "<div data-comments-fixture>Comments fixture</div>" },
}));

const wrappers: VueWrapper[] = [];
const cues = [
	{
		startSeconds: 0,
		text: 'Welcome <img src=x onerror="alert(1)"> & friends.',
	},
	{
		startSeconds: 65,
		text: "Kubernetes runs Kubernetes. Use [a+b] literally.",
	},
];
const chapters = [{ startTime: 60, title: "Cluster <setup>" }];
const source = readFileSync(
	"src/components/video/VideoTranscript.astro",
	"utf8",
);
let component: Parameters<
	Awaited<ReturnType<typeof AstroContainer.create>>["renderToString"]
>[0];
let clientScript: string;

// Compile the real component and execute its real script; no parallel fixture implementation.
function evaluate(source: string, imports: Record<string, unknown>) {
	const code = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const exports: Record<string, any> = {};
	new Function("require", "exports", code)((specifier: string) => {
		if (!(specifier in imports))
			throw new Error("Unexpected import: " + specifier);
		return imports[specifier];
	}, exports);
	return exports;
}

beforeAll(async () => {
	const compiled = await transform(source, {
		filename: "VideoTranscript.astro",
	});
	expect(compiled.diagnostics).toEqual([]);
	component = evaluate(compiled.code, {
		"astro/runtime/server/index.js": {
			...astroRuntime,
			createMetadata: () => ({}),
		},
		"@rawkodeacademy/design-system": { academyWatch },
		"./transcript-content": transcriptContent,
	}).default;
	const script = compiled.scripts[0];
	if (!script || script.type !== "inline")
		throw new Error("Expected one transcript enhancement script");
	clientScript = script.code;
});

const renderTranscript = async (props = { cues, chapters }) => {
	const container = await AstroContainer.create();
	return container.renderToString(component, { props });
};
const enhance = () =>
	evaluate(clientScript, { "./transcript-content": transcriptContent });
const mountHtml = async (html: string) => {
	const template = document.createElement("template");
	template.innerHTML = html;
	// Execute the compiler's extracted script ourselves, never load its virtual URL.
	for (const script of template.content.querySelectorAll("script"))
		script.remove();
	document.body.appendChild(template.content);
	enhance();
	await Promise.resolve();
};
const mountTranscript = async () => {
	await mountHtml(await renderTranscript());
	return document.querySelector("academy-transcript")!;
};
const search = (root: Element, query: string) => {
	const input = root.querySelector<HTMLInputElement>("input")!;
	input.value = query;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	return input;
};
const mountTabs = (resources: any[] = []) => {
	const wrapper = mount(VideoContentTabs, {
		props: { videoId: "video-one", resources },
		attachTo: document.body,
	});
	wrappers.push(wrapper);
	return wrapper;
};
beforeEach(() => {
	vi.mocked(fetch).mockReset();
	Object.defineProperty(Element.prototype, "scrollIntoView", {
		configurable: true,
		value: vi.fn(),
	});
});
afterEach(async () => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount();
	await flushPromises();
	document.body.innerHTML = "";
});

describe("single-copy SSR transcript with progressive search", () => {
	it("renders escaped full text once with chapter and timestamp links, with search hidden before JS", async () => {
		const html = await renderTranscript();
		expect(html).toContain("&lt;img");
		expect(html.match(/Kubernetes runs Kubernetes/g)).toHaveLength(1);
		expect(html).toContain("Cluster &lt;setup&gt;");
		expect(html).toContain('href="?t=0"');
		expect(html).toContain('data-chapter-link="65"');
		expect(html).toContain('href="?t=60"');
		expect(html).toMatch(/data-transcript-controls[^>]*hidden/);
		expect(html).not.toContain("<img");
		expect(html).not.toContain("astro-island");
		expect(html).not.toContain("initialCues");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("enhances existing text safely, preserves link nodes and input focus, and reports counts", async () => {
		const root = await mountTranscript();
		const text = root.querySelector("[data-transcript-text]")!;
		const links = [...root.querySelectorAll("a")];
		const input = root.querySelector<HTMLInputElement>("input")!;
		expect(
			root.querySelector<HTMLElement>("[data-transcript-controls]")!.hidden,
		).toBe(false);
		expect(root.querySelector("label")?.htmlFor).toBe(input.id);
		expect(root.querySelector("label")?.textContent).toBe("Search transcript");
		input.focus();
		search(root, "kubernetes");
		expect(
			[...root.querySelectorAll("mark")].map((node) => node.textContent),
		).toEqual(["Kubernetes", "Kubernetes"]);
		expect(root.querySelector('[role="status"]')?.textContent).toBe(
			"2 matches found",
		);
		expect(document.activeElement).toBe(input);
		expect(root.querySelector("[data-transcript-text]")).toBe(text);
		expect([...root.querySelectorAll("a")]).toEqual(links);
		for (const [index, link] of links.entries())
			expect(root.querySelectorAll("a")[index]).toBe(link);
		expect(root.querySelector("mark")?.className).toBe(
			academyWatch().transcriptHighlight,
		);
		search(root, "[a+b]");
		expect(root.querySelector("mark")?.textContent).toBe("[a+b]");
		expect(root.querySelector('[role="status"]')?.textContent).toBe(
			"1 match found",
		);
		search(root, "<img");
		expect(root.querySelector("mark")?.textContent).toBe("<img");
		expect(root.querySelector("img")).toBeNull();
		expect(root.textContent).toContain(cues[0]!.text);
		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("filters existing rows and chapter headings to literal matches without scrolling", async () => {
		const root = await mountTranscript();
		const rows = [
			...root.querySelectorAll<HTMLElement>("[data-transcript-row]"),
		];
		const sections = [
			...root.querySelectorAll<HTMLElement>("[data-transcript-section]"),
		];
		const heading = root.querySelector("h3")!;
		const chapterLink = heading.querySelector("a")!;
		search(root, "kubernetes");
		expect(rows.map((row) => row.hidden)).toEqual([true, false]);
		expect(sections.map((section) => section.hidden)).toEqual([true, false]);
		expect(heading.closest("[hidden]")).toBeNull();
		expect(chapterLink.getAttribute("href")).toBe("?t=60");
		search(root, "[a+b]");
		expect(rows.map((row) => row.hidden)).toEqual([true, false]);
		search(root, "Welcome");
		expect(rows.map((row) => row.hidden)).toEqual([false, true]);
		expect(sections.map((section) => section.hidden)).toEqual([false, true]);
		expect(heading.closest("[hidden]")).toBe(sections[1]);
		expect(root.querySelector("h3")).toBe(heading);
		expect(root.querySelector("h3 a")).toBe(chapterLink);
		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
	});

	it("hides every row and section on no result, then restores all text and headings for clear or one character", async () => {
		const root = await mountTranscript();
		const rows = [
			...root.querySelectorAll<HTMLElement>("[data-transcript-row]"),
		];
		const sections = [
			...root.querySelectorAll<HTMLElement>("[data-transcript-section]"),
		];
		search(root, "kubernetes");
		search(root, "not found");
		expect(root.querySelector('[role="status"]')?.textContent).toBe(
			"No matches found. Clear search to show all transcript paragraphs.",
		);
		expect(rows.every((row) => row.hidden)).toBe(true);
		expect(sections.every((section) => section.hidden)).toBe(true);
		expect(root.querySelector("h3")?.closest("[hidden]")).not.toBeNull();
		expect(
			root.querySelector('[role="status"]')?.closest("[hidden]"),
		).toBeNull();
		expect(root.querySelector("mark")).toBeNull();
		expect(
			[...root.querySelectorAll("[data-transcript-text]")].map(
				(node) => node.textContent,
			),
		).toEqual(cues.map((cue) => cue.text));
		for (const query of ["", "K"]) {
			search(root, "Welcome");
			search(root, query);
			expect(rows.every((row) => !row.hidden)).toBe(true);
			expect(sections.every((section) => !section.hidden)).toBe(true);
			expect(root.querySelector("h3")?.closest("[hidden]")).toBeNull();
			expect(root.querySelector('[role="status"]')?.textContent).toBe("");
			expect(root.querySelector("mark")).toBeNull();
			for (const [index, row] of rows.entries()) {
				expect(root.querySelectorAll("[data-transcript-row]")[index]).toBe(row);
				expect(row.querySelector("[data-transcript-text]")?.textContent).toBe(
					cues[index]!.text,
				);
			}
		}
		expect(
			root.querySelector('[role="status"] [data-transcript-text]'),
		).toBeNull();
		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
	});

	it("has an honest empty SSR state without a control or client request", async () => {
		const html = await renderTranscript({ cues: [], chapters: [] });
		expect(html).toContain("No transcript is available");
		expect(html).not.toContain("<input");
		await mountHtml(html);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("isolates multiple instances without duplicate IDs or cross-instance search", async () => {
		await mountHtml((await renderTranscript()) + (await renderTranscript()));
		const [first, second] = [
			...document.querySelectorAll("academy-transcript"),
		];
		search(first!, "kubernetes");
		expect(first!.querySelectorAll("mark")).toHaveLength(2);
		expect(second!.querySelector("mark")).toBeNull();
		const inputs = [...document.querySelectorAll("input")];
		expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
		for (const input of inputs)
			expect(input.labels?.[0]?.textContent).toBe("Search transcript");
	});

	it("cleans up on disconnect and restores search on reconnect without scrolling", async () => {
		const root = await mountTranscript();
		search(root, "Welcome");
		root.remove();
		const input = search(root, "kubernetes");
		expect(root.querySelector("mark")?.textContent).toBe("Welcome");
		document.body.appendChild(root);
		enhance();
		await Promise.resolve();
		search(root, input.value);
		expect(root.querySelectorAll("mark")).toHaveLength(2);
		expect(root.querySelector('[role="status"]')?.textContent).toBe(
			"2 matches found",
		);
		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
	});

	it("ships no client cue serialization, fetch, or HTML parsing path", () => {
		expect(source).not.toMatch(
			/initialCues|JSON\.stringify|set:html|innerHTML|insertAdjacentHTML|client:/,
		);
		expect(clientScript).not.toMatch(/\bfetch\s*\(/);
		expect(clientScript).not.toContain("scrollIntoView");
		expect(clientScript).toContain("document.createTextNode");
		expect(clientScript).toContain("paragraph.textContent");
	});
});

describe("transcript data helpers", () => {
	it("groups unsorted chapters without dropping leading text or mutating input", () => {
		const input = [
			{ startTime: 60, title: "Second" },
			{ startTime: 30, title: "First" },
			{ startTime: 120, title: "Empty" },
		];
		const result = transcriptSections(
			[
				{ startSeconds: 0, text: "Intro" },
				{ startSeconds: 30, text: "A" },
				{ startSeconds: 65, text: "B" },
			],
			input,
		);
		expect(result.map((section) => section.chapter?.title)).toEqual([
			undefined,
			"First",
			"Second",
		]);
		expect(
			result.flatMap((section) => section.cues).map((cue) => cue.text),
		).toEqual(["Intro", "A", "B"]);
		expect(input[0]?.title).toBe("Second");
	});
	it("rejects invalid cues, retains zero timestamps and formats hours", () => {
		expect(
			normalizeTranscriptCues([
				{ startSeconds: -1, text: "bad" },
				{ startSeconds: NaN, text: "bad" },
				{ startSeconds: 4, text: " " },
				...cues,
			]),
		).toEqual(cues);
		expect(formatTranscriptTimestamp(0)).toBe("0:00");
		expect(formatTranscriptTimestamp(3665)).toBe("1:01:05");
	});
	it.each([
		"[a+b]",
		".*",
		"(hi)",
		"\\path",
		"$money",
		"&lt;",
	])("matches %s literally, not as regular expressions or HTML entities", (query) => {
		const parts = transcriptTextParts("Before " + query + " after", query);
		expect(parts.filter((part) => part.match)).toEqual([
			{ text: query, match: true },
		]);
		expect(parts.map((part) => part.text).join("")).toBe(
			"Before " + query + " after",
		);
	});
});

describe("watch resources and comments", () => {
	it("renders comments directly with no one-option navigation", async () => {
		const wrapper = mountTabs();
		await flushPromises();
		expect(wrapper.find("select").exists()).toBe(false);
		expect(wrapper.text()).not.toContain("Transcript");
		expect(wrapper.text()).not.toContain("No resources");
		expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
		expect(wrapper.get("[data-comments-fixture]").isVisible()).toBe(true);
		expect(
			wrapper.get("[data-comments-fixture]").attributes("heading-level"),
		).toBe("2");
	});

	it("only renders valid destinations and puts unknown categories in other", async () => {
		const wrapper = mountTabs([
			{
				title: "Docs",
				type: "url",
				url: "https://example.com/docs",
				category: "documentation",
			},
			{
				title: "Unknown category",
				type: "url",
				url: "https://example.com/guide",
				category: "surprise",
			},
			{
				title: "Download",
				type: "file",
				filePath: "/files/slides.pdf",
				category: "slides",
			},
			{ title: "No destination", type: "url" },
			{ title: "Placeholder", type: "url", url: "#" },
			{ title: "Unsafe", type: "url", url: "javascript:alert(1)" },
			{ title: "Unsafe host", type: "url", url: "//example.com" },
			{ title: " ", type: "url", url: "https://example.com" },
		]);
		await flushPromises();
		expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe(
			"Resources",
		);
		expect(wrapper.find("select").exists()).toBe(false);
		expect(wrapper.findAll("a").map((link) => link.attributes("href"))).toEqual(
			[
				"https://example.com/docs",
				"/files/slides.pdf",
				"https://example.com/guide",
			],
		);
		expect(wrapper.text()).toContain("Additional Resources");
		expect(wrapper.text()).not.toContain("Placeholder");
		expect(wrapper.text()).not.toContain("Unsafe");
	});

	it("switches the visible tabs and falls back to comments when resources become invalid", async () => {
		const wrapper = mountTabs([
			{ title: "Docs", type: "url", url: "https://example.com" },
		]);
		await flushPromises();
		await wrapper.findAll('[role="tab"]')[0]!.trigger("click");
		await flushPromises();
		expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe(
			"Comments",
		);
		expect(wrapper.get("[data-comments-fixture]").isVisible()).toBe(true);
		await wrapper.findAll('[role="tab"]')[1]!.trigger("click");
		await flushPromises();
		expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe(
			"Resources",
		);
		await wrapper.setProps({
			resources: [{ title: "Gone", type: "url", url: "#" }],
		});
		await flushPromises();
		expect(wrapper.find("select").exists()).toBe(false);
		expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
		expect(wrapper.get("[data-comments-fixture]").isVisible()).toBe(true);
	});

	it("keeps tab and panel IDs unique across instances without duplicate selectors", async () => {
		const wrapper = mount(
			defineComponent(
				() => () =>
					h("div", [
						h(VideoContentTabs, {
							videoId: "one",
							resources: [
								{ title: "Docs", type: "url", url: "https://example.com" },
							],
						}),
						h(VideoContentTabs, {
							videoId: "two",
							resources: [
								{ title: "Docs", type: "url", url: "https://example.com" },
							],
						}),
					]),
			),
		);
		wrappers.push(wrapper);
		await flushPromises();
		expect(wrapper.find("select").exists()).toBe(false);
		const tabLists = wrapper.findAll('[role="tablist"]');
		expect(tabLists).toHaveLength(2);
		const tabs = wrapper.findAll('[role="tab"]');
		expect(tabs).toHaveLength(4);
		expect(new Set(tabs.map((tab) => tab.attributes("id"))).size).toBe(4);
		for (const tab of tabs) {
			await tab.trigger("click");
			await flushPromises();
			const panel = wrapper.get(
				'[id="' + tab.attributes("aria-controls") + '"]',
			);
			expect(panel.attributes("aria-labelledby")).toBe(tab.attributes("id"));
		}
	});

	it("SSR and hydration show the initial resource panel without requiring a tab click", async () => {
		const props = {
			videoId: "video-one",
			resources: [
				{
					title: "Docs",
					type: "url" as const,
					url: "https://example.com/docs",
				},
			],
		};
		const root = document.createElement("div");
		root.innerHTML = await renderToString(
			createSSRApp(VideoContentTabs, props),
		);
		document.body.appendChild(root);
		const assertSelected = () => {
			expect(
				root.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
			).toBe("Resources");
			expect(
				root
					.querySelector('a[href="https://example.com/docs"]')
					?.closest("[hidden]"),
			).toBeNull();
			expect(
				root.querySelector('a[href="https://example.com/docs"]'),
			).not.toBeNull();
		};
		assertSelected();
		const app = createSSRApp(VideoContentTabs, props);
		app.mount(root);
		try {
			await flushPromises();
			assertSelected();
		} finally {
			app.unmount();
		}
	});
});
