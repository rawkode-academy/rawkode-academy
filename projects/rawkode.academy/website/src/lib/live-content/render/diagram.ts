// d2 diagrams are rendered to SVG by the seeds and stored on
// content.rawkode.academy. Loaded through <img>, their dark theme would follow
// the operating system, so the site inlines them (as astro-d2's inline mode
// did) and rewrites d2's `prefers-color-scheme: dark` block to `:root.dark`
// selectors, which the site's theme toggle controls.
import type { ContentKV } from "../env";
import { hashString } from "../kv-cache";

const DIAGRAM_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_SVG_BYTES = 2 * 1024 * 1024;
/** Per-isolate memo bound: SVGs can be large, the isolate's memory is not. */
export const DIAGRAM_MEMO_MAX = 64;
/** A slow asset host must not hold the page render. */
export const DIAGRAM_FETCH_TIMEOUT_MS = 5_000;

/** Find the end of a `{ ... }` block starting at `open` (index of "{"). */
function matchingBrace(css: string, open: number): number {
	let depth = 0;
	for (let i = open; i < css.length; i++) {
		const ch = css[i];
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1;
}

function scopeRules(rules: string, scope: string): string {
	let out = "";
	let i = 0;
	while (i < rules.length) {
		const open = rules.indexOf("{", i);
		if (open === -1) {
			out += rules.slice(i);
			break;
		}
		const close = matchingBrace(rules, open);
		if (close === -1) {
			out += rules.slice(i);
			break;
		}
		const selector = rules.slice(i, open).trim();
		const body = rules.slice(open, close + 1);
		if (selector.startsWith("@")) {
			out += `${selector}${body}`;
		} else if (selector) {
			out += `${selector
				.split(",")
				.map((s) => `${scope} ${s.trim()}`)
				.join(",")}${body}`;
		}
		i = close + 1;
	}
	return out;
}

const DARK_MEDIA =
	/@media\s+(?:screen\s+and\s+)?\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/g;

/** Rewrite dark-mode media queries to `:root.dark` scoped rules. */
export function themeSvgForToggle(svg: string): string {
	let out = "";
	let cursor = 0;
	DARK_MEDIA.lastIndex = 0;
	for (let match = DARK_MEDIA.exec(svg); match; match = DARK_MEDIA.exec(svg)) {
		const open = match.index + match[0].length - 1;
		const close = matchingBrace(svg, open);
		if (close === -1) break;
		out += svg.slice(cursor, match.index);
		out += scopeRules(svg.slice(open + 1, close), ":root.dark");
		cursor = close + 1;
		DARK_MEDIA.lastIndex = cursor;
	}
	return out + svg.slice(cursor);
}

// d2 emits none of these. An SVG that carries any of them is not inlined, so
// the caller falls back to <img>, where SVG cannot run script. Rejecting is
// safer than stripping: a regex cannot fully sanitise markup.
const ACTIVE_CONTENT = [
	/<(?:script|foreignObject|iframe|object|embed)\b/i,
	/\son[a-z]+\s*=/i,
	/attributeName\s*=\s*["']?\s*(?:xlink:)?href/i,
	/[\s:]href\s*=\s*(?:["']\s*)?(?![\s"'#]|https?:\/\/|\/|data:image\/)/i,
];

/** Prepare a fetched SVG document for inlining in HTML. */
export function prepareInlineSvg(svg: string): string | undefined {
	const start = svg.indexOf("<svg");
	if (start === -1) return undefined;
	const body = svg.slice(start).trim();
	if (ACTIVE_CONTENT.some((pattern) => pattern.test(body))) return undefined;
	return themeSvgForToggle(body);
}

export interface DiagramFetchOptions {
	kv?: ContentKV | undefined;
	fetch?: typeof fetch | undefined;
	background?: (promise: Promise<unknown>) => void | Promise<void> | undefined;
}

const memo = new Map<string, Promise<string | undefined>>();

export function resetDiagramCacheForTests(): void {
	memo.clear();
}

export function diagramMemoSizeForTests(): number {
	return memo.size;
}

/** Fetch (KV-cached) and prepare a diagram SVG; undefined on failure. */
export function loadDiagramSvg(
	src: string,
	options: DiagramFetchOptions = {},
): Promise<string | undefined> {
	const existing = memo.get(src);
	if (existing) {
		// Refresh recency so the bound evicts the least recently used.
		memo.delete(src);
		memo.set(src, existing);
		return existing;
	}
	const key = `diagram:v1:${hashString(src)}`;
	const promise = (async () => {
		if (options.kv) {
			const cached = await options.kv
				.get(key, { type: "text" })
				.catch(() => null);
			if (cached) return cached;
		}
		const response = await (options.fetch ?? fetch)(src, {
			headers: { accept: "image/svg+xml" },
			signal: AbortSignal.timeout(DIAGRAM_FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			throw new Error(`Diagram ${src}: HTTP ${response.status}`);
		}
		const text = await response.text();
		if (text.length > MAX_SVG_BYTES)
			throw new Error(`Diagram ${src} is too large`);
		const svg = prepareInlineSvg(text);
		if (!svg) throw new Error(`Diagram ${src} is not an SVG`);
		if (options.kv) {
			const write = options.kv
				.put(key, svg, { expirationTtl: DIAGRAM_TTL_SECONDS })
				.catch(() => {});
			if (options.background) await options.background(write);
			else await write;
		}
		return svg;
	})().catch((error) => {
		console.warn("[content] diagram unavailable", error);
		if (memo.get(src) === promise) memo.delete(src);
		return undefined;
	});
	if (memo.size >= DIAGRAM_MEMO_MAX) {
		const oldest = memo.keys().next().value;
		if (oldest !== undefined) memo.delete(oldest);
	}
	memo.set(src, promise);
	return promise;
}
