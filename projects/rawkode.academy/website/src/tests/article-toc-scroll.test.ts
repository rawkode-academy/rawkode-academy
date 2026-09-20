import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("src/components/read/ArticleTOC.astro", "utf8");
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("ArticleTOC script missing");
const code = ts.transpileModule(script, {
	compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

let scrollTop = 0;
let viewportHeight = 1000;
let frames: FrameRequestCallback[] = [];
let listeners: Map<string, EventListener>;
let addListener: ReturnType<typeof vi.fn>;
const slugs = ["objectives", "chapter-1", "chapter-2", "chapter-3", "next"];

function setup() {
	// Execute the real component script with only geometry and window events stubbed.
	new Function("document", "window", code)(document, {
		get innerHeight() { return viewportHeight; },
		requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
		addEventListener: addListener,
	});
}

function dispatch(type: string) {
	listeners.get(type)?.(new Event(type));
}

function flushFrame() {
	const pending = frames;
	frames = [];
	for (const callback of pending) callback(0);
}

function current() {
	return [...document.querySelectorAll<HTMLAnchorElement>("[aria-current]")]
		.map((link) => link.dataset.tocSlug);
}

beforeEach(() => {
	scrollTop = 0;
	viewportHeight = 1000;
	frames = [];
	listeners = new Map();
	addListener = vi.fn((name: string, listener: EventListener) => listeners.set(name, listener));
	const links = slugs.map((slug) => `<a href="#${slug}" data-toc-slug="${slug}">${slug}</a>`).join("");
	document.body.innerHTML = `<nav>${links}</nav><nav>${links}</nav>` +
		slugs.map((slug) => `<h2 id="${slug}">${slug}</h2>`).join("");
	for (const [index, slug] of slugs.entries()) {
		vi.spyOn(document.getElementById(slug)!, "getBoundingClientRect")
			.mockImplementation(() => ({ top: 500 + index * 1000 - scrollTop }) as DOMRect);
	}
});

afterEach(() => {
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("ArticleTOC reading position", () => {
	it("does not mark an unread section above the article", () => {
		setup();
		expect(current()).toEqual([]);
	});

	it("initializes both navigation copies at a restored or anchored reading position", () => {
		scrollTop = 2500;
		setup();
		expect(current()).toEqual(["chapter-2", "chapter-2"]);
	});

	it("tracks jumps past several headings, reverse scrolling and the end", () => {
		setup();
		for (const [position, slug] of [[3500, "chapter-3"], [1400, "chapter-1"], [6000, "next"]] as const) {
			scrollTop = position;
			dispatch("scroll");
			flushFrame();
			expect(current()).toEqual([slug, slug]);
		}
		scrollTop = 0;
		dispatch("scroll");
		flushFrame();
		expect(current()).toEqual([]);
	});

	it("batches scroll events into one frame and registers a passive listener", () => {
		setup();
		dispatch("scroll");
		dispatch("scroll");
		dispatch("resize");
		expect(frames).toHaveLength(1);
		expect(addListener).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
	});

	it("recalculates the reading line after resize and late page layout", () => {
		scrollTop = 1400;
		setup();
		expect(current()).toEqual(["chapter-1", "chapter-1"]);
		viewportHeight = 200;
		dispatch("resize");
		flushFrame();
		expect(current()).toEqual(["objectives", "objectives"]);
		scrollTop = 2500;
		dispatch("load");
		flushFrame();
		expect(current()).toEqual(["chapter-2", "chapter-2"]);
	});

	it("does not install scroll work when no referenced heading exists", () => {
		document.querySelectorAll("h2").forEach((heading) => heading.remove());
		setup();
		expect(addListener).not.toHaveBeenCalled();
	});
});
