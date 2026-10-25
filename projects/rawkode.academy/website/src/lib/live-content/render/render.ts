// Renders stored rich-text documents to HTML the way the old Astro Markdown
// pipeline did: SmartyPants typography, technology autolinks, external links
// in a new tab, Expressive Code blocks, the site's Aside and Diagram markup,
// inline theme-aware diagrams, theme-aware images and island placeholders for
// videos, zoomable images and the interactive article components.
//
// Results are cached in KV by a hash of the document and render options, so a
// body is highlighted once per change, not once per request.

import { academyCallout, academyDiagram } from "@rawkodeacademy/design-system";
import {
	type AsideNode,
	type CodeBlockNode,
	type DiagramNode,
	type DocNode,
	escapeHtml,
	type HtmlOptions,
	type ImageNode,
	type InteractiveNode,
	isEmptyDoc,
	safeUrl,
	toHtmlAsync,
	type VideoNode,
	videoThumbnailUrl,
} from "@rawkodeacademy/rich-text";
import type { MarkdownHeading } from "astro";
import { type ContentKV, getContentEnv, runInBackground } from "../env";
import { hashString, stableStringify } from "../kv-cache";
import { type LoadedCollection, loadCollection } from "../store";
import type { CollectionName, ContentEntry } from "../types";
import {
	autolinkTechnologies,
	buildTechnologyLookup,
	type TechnologyLookup,
} from "./autolink";
import { codeAssets, highlightCode } from "./code";
import { loadDiagramSvg } from "./diagram";
import { islandHtml } from "./islands";
import { smartypants } from "./typography";

const RENDER_VERSION = "v2";
const RENDER_TTL_SECONDS = 30 * 24 * 60 * 60;
const MEMO_MAX = 128;
/** How long an isolate reuses a degraded render before retrying. */
const DEGRADED_MEMO_MS = 60_000;

export type RenderProfile = "prose" | "description";

export interface RenderOptions {
	/**
	 * "prose" (default): Markdown bodies, as Astro rendered content files.
	 * "description": video and show descriptions, as `marked` rendered them
	 * (no typography, autolinks or new-tab links).
	 */
	profile?: RenderProfile | undefined;
	/** Link technology names (prose only, default true). */
	autolink?: boolean | undefined;
	/** Technology ids never to autolink, e.g. the profile being rendered. */
	skipTechnologyIds?: string[] | undefined;
	/** Highlight code blocks with Expressive Code (default true). */
	highlight?: boolean | undefined;
	/** Inline diagram SVGs (default true; false keeps an <img>). */
	inlineDiagrams?: boolean | undefined;
	/** Use KV/memo caching (default true). */
	cache?: boolean | undefined;
	/** Override bindings (tests). */
	kv?: ContentKV | undefined;
	fetch?: typeof fetch | undefined;
	technologies?: TechnologyLookup | undefined;
}

export interface RenderedDocument {
	html: string;
	headings: MarkdownHeading[];
	/**
	 * Set when part of the output is a fallback for a transient failure (a
	 * diagram that could not be fetched, code that could not be
	 * highlighted). Such renders are not stored in KV, so the next render
	 * after the asset appears (e.g. an R2 upload) gets the real thing.
	 */
	degraded?: true;
}

const EMPTY: RenderedDocument = { html: "", headings: [] };

const cls = (value: string | undefined) => escapeHtml(value ?? "");

// ── hooks ─────────────────────────────────────────────────────────────────

/**
 * rehype-external-links semantics: absolute http(s) URLs open a new tab.
 * The old pipeline used its default rel="nofollow"; noopener is added for
 * target="_blank".
 */
export function isExternalHref(href: string): boolean {
	return /^https?:\/\//i.test(href.trim());
}

const ASIDE_ICON_PATHS: Record<"tip" | "caution" | "danger" | "info", string> =
	{
		tip: "M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18",
		caution:
			"M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
		danger:
			"M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z",
		info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
	};

/** Same markup as src/components/Aside.astro. */
export function asideHtml(node: AsideNode, children: string): string {
	const variant = node.attrs.variant;
	const tone = variant === "warning" ? "caution" : variant;
	const styles = academyCallout({ tone });
	return `<aside class="${cls(styles.root)}" aria-label="${escapeHtml(variant)}"><div class="${cls(styles.header)}"><svg class="${cls(styles.icon)}" aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="${ASIDE_ICON_PATHS[tone]}"></path></svg><span class="${cls(styles.label)}">${escapeHtml(variant)}</span></div><div class="${cls(styles.body)}">${children}</div></aside>`;
}

/** Same markup as src/components/articles/Diagram.astro (toggle script in RichText). */
export function diagramHtml(node: DiagramNode, inner: string): string {
	const { id, title, description } = node.attrs;
	if (!id || !title) {
		// A bare ```d2 fence: astro-d2 inlined the SVG without a wrapper.
		// role="img" needs an accessible name; without a title keep the SVG's
		// own semantics (its <title>, if any) instead of an unnamed image.
		return `<div class="rt-diagram"${title ? ` role="img" aria-label="${escapeHtml(title)}"` : ""}>${inner}</div>`;
	}
	const s = academyDiagram();
	const safeId = escapeHtml(id);
	const safeTitle = escapeHtml(title);
	return `<figure class="${cls(s.root)}" aria-labelledby="${safeId}-caption"><figcaption class="${cls(s.caption)}" id="${safeId}-caption">${safeTitle}</figcaption><label class="${cls(s.toggle)}"><input type="checkbox" data-diagram-toggle aria-controls="${safeId}-viewport"> Enlarge diagram</label><div id="${safeId}-viewport" class="${cls(s.viewport)}" data-diagram-viewport role="region" aria-label="${safeTitle} — scroll to explore when enlarged" tabindex="0"><div class="${cls(s.image)}" data-diagram-image role="img" aria-label="${safeTitle}" aria-describedby="${safeId}-description">${inner}</div></div><div class="${cls(s.description)}" id="${safeId}-description">${escapeHtml(description ?? "")}</div></figure>`;
}

function imgTag(
	src: string,
	alt: string,
	extra: Record<string, string | number | null | undefined> = {},
): string {
	const url = safeUrl(src);
	let attrs = `${url ? ` src="${escapeHtml(url)}"` : ""} alt="${escapeHtml(alt)}"`;
	for (const [name, value] of Object.entries(extra)) {
		if (value === null || value === undefined) continue;
		attrs += ` ${name}="${escapeHtml(String(value))}"`;
	}
	return `<img${attrs} loading="lazy" decoding="async">`;
}

/** ThemeAwareImage / ZoomableImage / plain images. */
export function imageHtml(node: ImageNode): string {
	const { src, alt, title, width, height, darkSrc, zoomable } = node.attrs;
	const dims = { width, height, title };
	if (darkSrc) {
		// Same classes as ThemeAwareImage.astro; RichText ships the CSS, which
		// follows the site's .dark class rather than the OS preference.
		return `<div class="theme-aware-image">${imgTag(src, alt ?? "", { ...dims, class: "theme-light-only" })}${imgTag(darkSrc, alt ?? "", { ...dims, class: "theme-dark-only" })}</div>`;
	}
	const img = imgTag(src, alt ?? "", dims);
	if (zoomable) {
		return islandHtml(
			{
				component: "ZoomableImage",
				hydrate: "only",
				props: { src, alt: alt ?? "", width, height },
			},
			img,
		);
	}
	return img;
}

export function videoHtml(node: VideoNode): string {
	const thumbnailUrl =
		node.attrs.thumbnailUrl ?? videoThumbnailUrl(node.attrs.videoId);
	return islandHtml(
		{
			component: "VideoPlayer",
			hydrate: "only",
			props: { video: node.attrs.videoId, thumbnailUrl },
		},
		imgTag(thumbnailUrl, "Video thumbnail"),
	);
}

export function interactiveHtml(node: InteractiveNode): string {
	return islandHtml({
		component: node.attrs.component,
		hydrate: node.attrs.hydrate,
		props: node.attrs.props,
	});
}

interface HookState {
	hasCode: boolean;
	codeStyles: Set<string>;
	degraded: boolean;
}

function buildHooks(
	options: RenderOptions,
	state: HookState,
	env: { kv?: ContentKV | undefined },
): HtmlOptions {
	const prose = (options.profile ?? "prose") === "prose";
	return {
		marks: {
			link: (mark, inner) => {
				if (!prose || !isExternalHref(mark.attrs.href)) return undefined;
				const href = safeUrl(mark.attrs.href);
				const title = mark.attrs.title
					? ` title="${escapeHtml(mark.attrs.title)}"`
					: "";
				const cls = mark.attrs.class
					? ` class="${escapeHtml(mark.attrs.class)}"`
					: "";
				return `<a${href ? ` href="${escapeHtml(href)}"` : ""} target="_blank" rel="nofollow noopener"${cls}${title}>${inner}</a>`;
			},
		},
		nodes: {
			codeBlock: async (node: CodeBlockNode) => {
				if (options.highlight === false) return undefined;
				try {
					const { html, styles } = await highlightCode(
						node.content?.[0]?.text ?? "",
						node.attrs.language,
						node.attrs.title,
						node.attrs.meta,
					);
					state.hasCode = true;
					if (styles) state.codeStyles.add(styles);
					return html;
				} catch (error) {
					console.warn("[content] code highlighting failed", error);
					state.degraded = true;
					return undefined;
				}
			},
			aside: (node, { children }) => asideHtml(node, children),
			diagram: async (node) => {
				const src = node.attrs.src;
				let inner: string | undefined;
				if (src && options.inlineDiagrams !== false) {
					inner = await loadDiagramSvg(src, {
						kv: env.kv,
						fetch: options.fetch,
						background: runInBackground,
					});
				}
				if (!inner && src) {
					if (options.inlineDiagrams !== false) state.degraded = true;
					inner = imgTag(src, node.attrs.title ?? "Diagram");
				}
				if (!inner) return undefined; // default: the d2 source in a <pre>
				return diagramHtml(node, inner);
			},
			image: (node) => imageHtml(node),
			video: (node) => videoHtml(node),
			interactive: (node) => interactiveHtml(node),
			embed: (_node, { renderDefault }) =>
				renderDefault().replace("<iframe", '<iframe style="border:0"'),
		},
	};
}

// ── headings ──────────────────────────────────────────────────────────────

function decodeEntities(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&amp;/g, "&");
}

/** Headings as Astro's render() returned them ({ depth, slug, text }). */
export function extractHeadings(html: string): MarkdownHeading[] {
	const headings: MarkdownHeading[] = [];
	const re = /<h([1-6]) id="([^"]*)">([\s\S]*?)<\/h\1>/g;
	for (let m = re.exec(html); m; m = re.exec(html)) {
		headings.push({
			depth: Number(m[1]),
			slug: decodeEntities(m[2] ?? ""),
			text: decodeEntities((m[3] ?? "").replace(/<[^>]+>/g, "")).trim(),
		});
	}
	return headings;
}

// ── technology lookup ─────────────────────────────────────────────────────

const lookups = new WeakMap<object, TechnologyLookup>();

async function technologyLookup(): Promise<TechnologyLookup> {
	const loaded: LoadedCollection<"technologies"> =
		await loadCollection("technologies");
	let lookup = lookups.get(loaded);
	if (!lookup) {
		lookup = buildTechnologyLookup(
			loaded.entries.map((entry) => ({ id: entry.id, name: entry.data.name })),
		);
		lookups.set(loaded, lookup);
	}
	return lookup;
}

const lookupSignatures = new WeakMap<TechnologyLookup, string>();
function lookupSignature(lookup: TechnologyLookup): string {
	let signature = lookupSignatures.get(lookup);
	if (!signature) {
		signature = hashString(stableStringify([...lookup.names.entries()]));
		lookupSignatures.set(lookup, signature);
	}
	return signature;
}

// ── rendering ─────────────────────────────────────────────────────────────

const memo = new Map<
	string,
	{ promise: Promise<RenderedDocument>; expires: number }
>();

export function resetRenderCacheForTests(): void {
	memo.clear();
}

/** Render without caching (exported for tests). */
export async function renderDocumentUncached(
	doc: DocNode,
	options: RenderOptions = {},
	lookup?: TechnologyLookup,
): Promise<RenderedDocument> {
	if (isEmptyDoc(doc)) return EMPTY;
	const prose = (options.profile ?? "prose") === "prose";
	let prepared = doc;
	if (prose && options.autolink !== false && lookup) {
		prepared = autolinkTechnologies(prepared, lookup, {
			skipIds: options.skipTechnologyIds,
		});
	}
	if (prose) prepared = smartypants(prepared);
	const state: HookState = {
		hasCode: false,
		codeStyles: new Set(),
		degraded: false,
	};
	let html = await toHtmlAsync(
		prepared,
		buildHooks(options, state, { kv: options.kv }),
	);
	if (state.hasCode) {
		// Self-contained output: RichText, feeds and render() all get styles.
		const assets = await codeAssets().catch(() => undefined);
		if (!assets) state.degraded = true;
		if (assets) {
			const styles = assets.styles + [...state.codeStyles].join("");
			const scripts = assets.scripts
				.map((script) => `<script type="module">${script}</script>`)
				.join("");
			html = `<style>${styles}</style>${html}${scripts}`;
		}
	}
	return {
		html,
		headings: extractHeadings(html),
		...(state.degraded ? { degraded: true as const } : {}),
	};
}

export async function renderDocument(
	doc: DocNode | undefined | null,
	options: RenderOptions = {},
): Promise<RenderedDocument> {
	if (!doc || isEmptyDoc(doc)) return EMPTY;
	const env = options.kv
		? { CONTENT_CACHE: options.kv }
		: await getContentEnv();
	const kv = options.kv ?? env.CONTENT_CACHE;
	const prose = (options.profile ?? "prose") === "prose";
	const lookup =
		prose && options.autolink !== false
			? (options.technologies ??
				(await technologyLookup().catch(() => undefined)))
			: undefined;
	const resolved: RenderOptions = { ...options, kv };
	if (options.cache === false)
		return renderDocumentUncached(doc, resolved, lookup);

	const signature = stableStringify({
		p: options.profile ?? "prose",
		a: options.autolink !== false,
		s: [...(options.skipTechnologyIds ?? [])].sort(),
		h: options.highlight !== false,
		d: options.inlineDiagrams !== false,
		t: lookup ? lookupSignature(lookup) : null,
	});
	const key = `render:${RENDER_VERSION}:${hashString(stableStringify(doc))}:${hashString(signature)}`;
	const existing = memo.get(key);
	if (existing && existing.expires > Date.now()) return existing.promise;
	const promise = (async () => {
		if (kv) {
			const cached = await kv
				.get<RenderedDocument>(key, { type: "json" })
				.catch(() => null);
			if (cached && typeof cached.html === "string") return cached;
		}
		const rendered = await renderDocumentUncached(doc, resolved, lookup);
		if (kv && !rendered.degraded) {
			await runInBackground(
				kv.put(key, JSON.stringify(rendered), {
					expirationTtl: RENDER_TTL_SECONDS,
				}),
			);
		}
		return rendered;
	})();
	if (memo.size >= MEMO_MAX) {
		const first = memo.keys().next().value;
		if (first !== undefined) memo.delete(first);
	}
	const entry = { promise, expires: Number.POSITIVE_INFINITY };
	memo.delete(key);
	memo.set(key, entry);
	promise.then(
		(rendered) => {
			if (rendered.degraded) entry.expires = Date.now() + DEGRADED_MEMO_MS;
		},
		() => {
			if (memo.get(key) === entry) memo.delete(key);
		},
	);
	return promise;
}

/** The document an entry renders as its body. */
export function entryDocument(
	entry: ContentEntry<CollectionName>,
): DocNode | undefined {
	const data = entry.data as { body?: DocNode; descriptionDoc?: DocNode };
	if (entry.collection === "videos" || entry.collection === "shows") {
		return data.descriptionDoc;
	}
	return data.body;
}

/**
 * Render an entry's main document: bodies, biographies, technology profiles
 * (without self-links) and video/show descriptions (marked-style).
 */
export async function renderEntry(
	entry: ContentEntry<CollectionName> | undefined | null,
	options: RenderOptions = {},
): Promise<RenderedDocument> {
	if (!entry) return EMPTY;
	const doc = entryDocument(entry);
	const profile: RenderProfile =
		options.profile ??
		(entry.collection === "videos" || entry.collection === "shows"
			? "description"
			: "prose");
	const skip =
		entry.collection === "technologies"
			? [entry.id, ...(options.skipTechnologyIds ?? [])]
			: options.skipTechnologyIds;
	return renderDocument(doc, {
		...options,
		profile,
		// remark-tech-autolink skipped technology profile files entirely, so
		// profiles get no autolinks unless asked.
		...(entry.collection === "technologies" && options.autolink === undefined
			? { autolink: false }
			: {}),
		...(skip ? { skipTechnologyIds: skip } : {}),
	});
}
