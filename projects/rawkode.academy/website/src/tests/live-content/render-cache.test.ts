import type { BlockNode, DocNode } from "@rawkodeacademy/rich-text";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetContentCacheForTests } from "@/lib/live-content/kv-cache";
import { buildTechnologyLookup } from "@/lib/live-content/render/autolink";
import { resetDiagramCacheForTests } from "@/lib/live-content/render/diagram";
import {
	renderDocument,
	resetRenderCacheForTests,
} from "@/lib/live-content/render/render";
import { memoryKv } from "./memory-kv";

const technologies = buildTechnologyLookup([]);
const diagramDoc = (): DocNode => ({
	type: "doc",
	content: [
		{
			type: "diagram",
			attrs: {
				id: null,
				title: "Architecture",
				description: null,
				language: "d2",
				source: "a -> b",
				meta: null,
				src: "https://content.rawkode.academy/articles/x/diagrams/new.svg",
			},
		} as BlockNode,
	],
});

beforeEach(() => {
	resetContentCacheForTests();
	resetRenderCacheForTests();
	resetDiagramCacheForTests();
});

describe("degraded renders", () => {
	it("does not pin a diagram fallback in KV, so the SVG appears once it is uploaded", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const kv = memoryKv();
		let uploaded = false;
		const fetchMock = vi.fn(async () =>
			uploaded
				? new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
				: new Response("missing", { status: 404 }),
		);
		const options = { kv, fetch: fetchMock, technologies, highlight: false };

		const before = await renderDocument(diagramDoc(), options);
		expect(before.html).toContain("<img");
		expect(before.degraded).toBe(true);
		expect([...kv.store.keys()].some((k) => k.startsWith("render:"))).toBe(
			false,
		);

		// The SVG lands on R2; a new isolate renders it inline and stores it.
		uploaded = true;
		resetRenderCacheForTests();
		resetDiagramCacheForTests();
		const after = await renderDocument(diagramDoc(), options);
		expect(after.html).toContain("<svg");
		expect(after.degraded).toBeUndefined();
		expect([...kv.store.keys()].some((k) => k.startsWith("render:"))).toBe(
			true,
		);
	});

	it("retries a degraded render in the same isolate after a minute", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		let t = Date.parse("2026-10-23T12:00:00Z");
		vi.spyOn(Date, "now").mockImplementation(() => t);
		let uploaded = false;
		const fetchMock = vi.fn(async () =>
			uploaded
				? new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
				: new Response("missing", { status: 404 }),
		);
		const options = { fetch: fetchMock, technologies, highlight: false };
		expect((await renderDocument(diagramDoc(), options)).degraded).toBe(true);
		uploaded = true;
		resetDiagramCacheForTests();
		// Within the minute the memoised fallback is reused...
		expect((await renderDocument(diagramDoc(), options)).degraded).toBe(true);
		// ...then the render is retried.
		t += 61_000;
		const retried = await renderDocument(diagramDoc(), options);
		expect(retried.html).toContain("<svg");
		vi.restoreAllMocks();
	});
});
