// Islands inside rendered HTML. Components cannot come out of an HTML string,
// so the renderer leaves <rt-island> placeholders (with a static fallback
// inside, for feeds and other plain-HTML consumers) and <RichText> swaps each
// one for the real component with its client directive.
import { escapeHtml, type JsonValue } from "@rawkodeacademy/rich-text";

export type IslandName =
	| "CgroupTimeline"
	| "CgroupTreeDiagram"
	| "HierarchyExplorer"
	| "PodCgroupMapper"
	| "ResourceSimulator"
	| "VideoPlayer"
	| "ZoomableImage";

export interface IslandPlaceholder {
	component: IslandName;
	hydrate: string;
	props: Record<string, JsonValue>;
}

export function islandHtml(island: IslandPlaceholder, fallback = ""): string {
	return `<rt-island data-component="${escapeHtml(island.component)}" data-hydrate="${escapeHtml(island.hydrate)}" data-props="${escapeHtml(JSON.stringify(island.props))}">${fallback}</rt-island>`;
}

const ISLAND =
	/<rt-island data-component="([^"]*)" data-hydrate="([^"]*)" data-props="([^"]*)">([\s\S]*?)<\/rt-island>/g;

function decodeAttribute(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export type HtmlSegment =
	| { kind: "html"; html: string }
	| ({ kind: "island"; fallback: string } & IslandPlaceholder);

/** Split rendered HTML into raw HTML runs and island placeholders. */
export function splitIslands(html: string): HtmlSegment[] {
	const segments: HtmlSegment[] = [];
	let cursor = 0;
	ISLAND.lastIndex = 0;
	for (let match = ISLAND.exec(html); match; match = ISLAND.exec(html)) {
		if (match.index > cursor) {
			segments.push({ kind: "html", html: html.slice(cursor, match.index) });
		}
		let props: Record<string, JsonValue> = {};
		try {
			props = JSON.parse(decodeAttribute(match[3] ?? "{}"));
		} catch {}
		segments.push({
			kind: "island",
			component: decodeAttribute(match[1] ?? "") as IslandName,
			hydrate: decodeAttribute(match[2] ?? "visible"),
			props,
			fallback: match[4] ?? "",
		});
		cursor = match.index + match[0].length;
	}
	if (cursor < html.length)
		segments.push({ kind: "html", html: html.slice(cursor) });
	return segments;
}

/** Plain-HTML consumers (feeds): keep each island's static fallback only. */
export function stripIslands(html: string): string {
	ISLAND.lastIndex = 0;
	return html.replace(ISLAND, (_m, _c, _h, _p, fallback: string) => fallback);
}
