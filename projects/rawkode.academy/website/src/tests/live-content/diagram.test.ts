import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DIAGRAM_MEMO_MAX,
	diagramMemoSizeForTests,
	loadDiagramSvg,
	resetDiagramCacheForTests,
} from "@/lib/live-content/render/diagram";
import { diagramHtml } from "@/lib/live-content/render/render";

const svg = (n: number) =>
	`<svg xmlns="http://www.w3.org/2000/svg"><text>${n}</text></svg>`;

describe("loadDiagramSvg", () => {
	beforeEach(() => resetDiagramCacheForTests());

	it("keeps the per-isolate memo bounded", async () => {
		const fetcher = vi.fn(
			async (url: string | URL | Request) =>
				new Response(svg(Number(String(url).split("/").pop()))),
		) as unknown as typeof fetch;
		for (let i = 0; i < DIAGRAM_MEMO_MAX + 20; i++) {
			await loadDiagramSvg(`https://content.rawkode.academy/d/${i}`, {
				fetch: fetcher,
			});
		}
		expect(diagramMemoSizeForTests()).toBe(DIAGRAM_MEMO_MAX);
	});

	it("passes an abort signal so a hung asset host cannot stall the render", async () => {
		let signal: AbortSignal | null | undefined;
		const fetcher = vi.fn(
			async (_url: string | URL | Request, init?: RequestInit) => {
				signal = init?.signal;
				throw new DOMException("The operation timed out.", "TimeoutError");
			},
		) as unknown as typeof fetch;
		const result = await loadDiagramSvg(
			"https://content.rawkode.academy/hung",
			{
				fetch: fetcher,
			},
		);
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(result).toBeUndefined();
		// Failures are not memoised.
		expect(diagramMemoSizeForTests()).toBe(0);
	});
});

describe("diagramHtml accessibility", () => {
	it("does not emit an unnamed role=img for bare diagrams", () => {
		const html = diagramHtml(
			{ type: "diagram", attrs: { src: "x.svg" } } as never,
			"<svg></svg>",
		);
		expect(html).not.toContain('role="img"');
	});

	it("names titled-but-unidentified diagrams", () => {
		const html = diagramHtml(
			{ type: "diagram", attrs: { src: "x.svg", title: "Flow" } } as never,
			"<svg></svg>",
		);
		expect(html).toContain('role="img" aria-label="Flow"');
	});
});
