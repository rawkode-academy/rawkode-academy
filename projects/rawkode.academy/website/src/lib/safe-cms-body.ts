import { Marked } from "marked";
import { codeToHtml } from "shiki";
import sanitizeHtml from "sanitize-html";
import {
	resolveMediaAsset,
	type PayloadEntry,
	type PayloadMediaAsset,
} from "@/lib/payload-content";

export type SafeBodyBlock =
	| { kind: "markdown"; html: string }
	| {
			kind: "aside";
			variant: "tip" | "caution" | "danger" | "info" | "warning";
			html: string;
	  }
	| {
			kind: "diagram";
			id: string;
			title: string;
			description: string;
			sourceHash?: string;
	  }
	| { kind: "interactive"; name: string }
	| { kind: "video"; videoId: string }
	| {
			kind: "theme-image";
			lightSrc: string;
			darkSrc: string;
			alt: string;
			className?: string;
	  }
	| { kind: "zoom-image"; src: string; alt: string };

const COMPONENT_NAMES = new Set([
	"Aside",
	"Diagram",
	"CgroupTimeline",
	"CgroupTreeDiagram",
	"HierarchyExplorer",
	"ResourceSimulator",
	"PodCgroupMapper",
	"VideoPlayer",
	"ThemeAwareImage",
	"ZoomableImage",
]);

const INTERACTIVE_COMPONENTS = new Set([
	"CgroupTimeline",
	"CgroupTreeDiagram",
	"HierarchyExplorer",
	"ResourceSimulator",
	"PodCgroupMapper",
]);

const sanitizeOptions: sanitizeHtml.IOptions = {
	allowedTags: sanitizeHtml.defaults.allowedTags.concat([
		"img",
		"hr",
		"table",
		"thead",
		"tbody",
		"tr",
		"th",
		"td",
		"del",
		"details",
		"summary",
		"figure",
		"figcaption",
		"iframe",
	]),
	allowedAttributes: {
		...sanitizeHtml.defaults.allowedAttributes,
		img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
		iframe: [
			"src",
			"width",
			"height",
			"title",
			"loading",
			"referrerpolicy",
			"allow",
			"allowfullscreen",
			"sandbox",
		],
		code: ["class"],
		pre: ["class", "style"],
		span: ["class", "style"],
		a: ["href", "name", "target", "rel"],
	},
	allowedSchemes: ["http", "https", "mailto", "tel"],
	transformTags: {
		iframe: (_tagName, attribs) => {
			let url: URL;
			try {
				url = new URL(attribs.src ?? "");
			} catch {
				return { tagName: "span", attribs: {} };
			}

			const youtube =
				url.protocol === "https:" &&
				url.hostname === "www.youtube-nocookie.com" &&
				!url.port &&
				!url.username &&
				!url.password &&
				!url.search &&
				!url.hash &&
				/^\/embed\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
			const giphy =
				url.protocol === "https:" &&
				url.hostname === "giphy.com" &&
				!url.port &&
				!url.username &&
				!url.password &&
				!url.search &&
				!url.hash &&
				/^\/embed\/[A-Za-z0-9]+\/?$/.test(url.pathname);
			if (!youtube && !giphy) return { tagName: "span", attribs: {} };

			const dimension = (value: string | undefined, fallback: number) => {
				const parsed = Number(value);
				return String(
					Number.isInteger(parsed) && parsed > 0
						? Math.min(parsed, 1920)
						: fallback,
				);
			};
			return {
				tagName: "iframe",
				attribs: {
					src: url.href,
					width: dimension(attribs.width, 560),
					height: dimension(attribs.height, 315),
					title: youtube ? "YouTube video player" : "Giphy animation",
					loading: "lazy",
					referrerpolicy: "strict-origin-when-cross-origin",
					allow: youtube
						? "encrypted-media; picture-in-picture; fullscreen"
						: "fullscreen",
					allowfullscreen: "",
					sandbox: "allow-scripts allow-same-origin allow-presentation",
				},
			};
		},
		a: (tagName, attribs) => ({
			tagName,
			attribs: {
				...attribs,
				...(attribs.href?.startsWith("http")
					? { target: "_blank", rel: "noopener noreferrer" }
					: {}),
			},
		}),
	},
	allowedStyles: {
		pre: {
			color: [/^#[0-9a-f]{3,8}$/i],
			"background-color": [/^#[0-9a-f]{3,8}$/i],
		},
		span: {
			color: [/^#[0-9a-f]{3,8}$/i],
			"font-style": [/^italic$/],
			"font-weight": [/^(?:bold|[1-9][0-9]{0,2})$/],
			"text-decoration": [/^(?:underline|line-through)$/],
		},
	},
};

function escapeAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function createMarkdownRenderer(assets: PayloadMediaAsset[]): Marked {
	const marked = new Marked({ breaks: true, gfm: true });
	marked.use({
		renderer: {
			image(token: { href: string; title?: string | null; text: string }) {
				const resolved = resolveMediaAsset(token.href, assets, 1280);
				const href = resolved?.url ?? token.href;
				const title = token.title ? ` title="${escapeAttribute(token.title)}"` : "";
				return `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(token.text)}" loading="lazy" decoding="async"${title}>`;
			},
		},
	});
	return marked;
}

async function markdownToSafeHtml(
	markdown: string,
	marked: Marked,
): Promise<string> {
	const codeBlocks: Promise<string>[] = [];
	const withMarkers = markdown.replace(
		/(^|\n)```([^\n`]*)\n([\s\S]*?)\n```(?=\n|$)/g,
		(whole: string, prefix: string, languageSource: string, code: string) => {
			const language = languageSource.trim().split(/\s+/)[0]?.toLowerCase() ?? "text";
			if (!supportedLanguages.has(language)) return whole;
			codeBlocks.push(highlightCode(code, language));
			return `${prefix}\n<!--cms-code-${codeBlocks.length - 1}-->\n`;
		},
	);
	const highlighted = await Promise.all(codeBlocks);
	let html = await marked.parse(withMarkers);
	html = html.replace(/<!--cms-code-(\d+)-->/g, (_marker, index: string) =>
		highlighted[Number(index)] ?? "",
	);
	return sanitizeHtml(addHeadingIds(html), sanitizeOptions);
}

const supportedLanguages = new Set([
	"bash", "sh", "shell", "json", "javascript", "js", "typescript", "ts",
	"jsx", "tsx", "yaml", "yml", "go", "python", "py", "rust", "rs",
	"sql", "dockerfile", "markdown", "html", "css", "toml", "cue",
]);

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

async function highlightCode(code: string, requestedLanguage: string): Promise<string> {
	const aliases: Record<string, string> = {
		sh: "bash", shell: "bash", js: "javascript", ts: "typescript", py: "python",
		rs: "rust", yml: "yaml",
	};
	try {
		return await codeToHtml(code, {
			lang: aliases[requestedLanguage] ?? requestedLanguage,
			theme: "github-dark",
		});
	} catch {
		return `<pre><code class="language-${escapeAttribute(requestedLanguage)}">${escapeHtml(code)}</code></pre>`;
	}
}

function addHeadingIds(html: string): string {
	const counts = new Map<string, number>();
	return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_whole, depth: string, inner: string) => {
		const text = inner.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, " ").trim();
		const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
		const count = counts.get(base) ?? 0;
		counts.set(base, count + 1);
		const slug = count ? `${base}-${count}` : base;
		return `<h${depth} id="${escapeAttribute(slug)}">${inner}</h${depth}>`;
	});
}

function d2Source(inner: string | undefined): string | undefined {
	const match = inner?.match(/```d2(?:\s+[^\n]*)?\s*\n([\s\S]*?)\n```/i);
	const source = match?.[1]?.replace(/\r\n/g, "\n").trim();
	return source || undefined;
}

function normalizeD2Source(source: string): string {
	return source.replace(/\r\n/g, "\n").trim();
}

async function appendMarkdownAndDiagrams(
	blocks: SafeBodyBlock[],
	markdown: string,
	marked: Marked,
): Promise<void> {
	const fence = String.fromCharCode(96).repeat(3);
	const expression = new RegExp(
		`(^|\\n)${fence}d2(?:\\s+[^\\n]*)?\\s*\\n([\\s\\S]*?)\\n${fence}(?=\\n|$)`,
		"gi",
	);
	let cursor = 0;
	for (const match of markdown.matchAll(expression)) {
		const offset = match.index ?? 0;
		const prefix = match[1] ?? "";
		const fenceStart = offset + prefix.length;
		const before = await markdownToSafeHtml(markdown.slice(cursor, fenceStart), marked);
		if (before) blocks.push({ kind: "markdown", html: before });

		const source = normalizeD2Source(match[2] ?? "");
		if (source) {
			const sourceHash = await sha256Hex(source);
			blocks.push({
				kind: "diagram",
				id: `cms-d2-${sourceHash.slice(0, 12)}`,
				title: "Diagram",
				description: "D2 diagram",
				sourceHash,
			});
		}
		cursor = offset + match[0].length;
	}
	const after = await markdownToSafeHtml(markdown.slice(cursor), marked);
	if (after) blocks.push({ kind: "markdown", html: after });
}

async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function readAttributes(source: string): Record<string, string> {
	const result: Record<string, string> = {};
	const expression = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
	for (const match of source.matchAll(expression)) {
		const name = match[1];
		const value = match[2] ?? match[3] ?? match[4] ?? "";
		if (!name) continue;
		result[name] = value.trim();
	}
	return result;
}

function lookupImportedAsset(
	value: string | undefined,
	assets: PayloadMediaAsset[],
	imports: Map<string, string>,
): string | undefined {
	if (!value) return undefined;
	const dynamicImport = value.match(/import\(\s*["']([^"']+)["']\s*\)/);
	const literal = value.match(/^["']([^"']+)["']$/);
	const identifier = value.match(/^[A-Za-z_$][\w$]*$/);
	const relativePath =
		dynamicImport?.[1] ??
		literal?.[1] ??
		(identifier ? imports.get(identifier[0]) : undefined);
	if (!relativePath) return undefined;
	return resolveMediaAsset(relativePath, assets)?.url;
}

function stripMdxImports(body: string): {
	body: string;
	assetImports: Map<string, string>;
} {
	const lines = body.split("\n");
	const assetImports = new Map<string, string>();
	let index = 0;
	while (index < lines.length) {
		if (!lines[index]?.trim()) {
			index += 1;
			continue;
		}
		if (!/^import\b/.test(lines[index] ?? "")) break;
		const statementLines = [lines[index] ?? ""];
		const couldBeMultiline =
			/^import\s*(?:\{|\*)/.test(statementLines[0] ?? "");
		index += 1;
		while (
			couldBeMultiline &&
			index < lines.length &&
			!/\bfrom\s*["'][^"']+["']\s*;?\s*$/.test(statementLines.join("\n")) &&
			!/^import\s*["'][^"']+["']\s*;?\s*$/.test(statementLines.join("\n"))
		) {
			statementLines.push(lines[index] ?? "");
			index += 1;
		}
		const statement = statementLines.join("\n");
		const source =
			statement.match(/\bfrom\s*["']([^"']+)["']\s*;?\s*$/)?.[1] ??
			statement.match(/^import\s*["']([^"']+)["']\s*;?\s*$/)?.[1];
		const localName = statement.match(
			/^import\s+([A-Za-z_$][\w$]*)\s*(?:,|\s+from\b)/,
		)?.[1];
		if (!source) {
			// A code sample such as Python's "import json" is content, not an
			// executable MDX import declaration.
			index -= statementLines.length;
			break;
		}
		if (localName && (source.startsWith("./") || source.startsWith("../"))) {
			assetImports.set(localName, source);
		}
	}
	while (index < lines.length && !lines[index]?.trim()) index += 1;
	return { body: lines.slice(index).join("\n"), assetImports };
}

function customComponentPattern(): RegExp {
	const names = [...COMPONENT_NAMES].join("|");
	return new RegExp(
		`<(Aside|Diagram)\\b([^>]*)>([\\s\\S]*?)<\\/\\1\\s*>|<(${names})\\b([^>]*)\\/>`,
		"g",
	);
}

function componentBlock(
	name: string,
	attributesSource: string,
	inner: string | undefined,
	assets: PayloadMediaAsset[],
	imports: Map<string, string>,
): SafeBodyBlock | undefined {
	const attributes = readAttributes(attributesSource);
	if (name === "Aside") {
		const variant = attributes.variant;
		if (
			variant !== "tip" &&
			variant !== "caution" &&
			variant !== "danger" &&
			variant !== "info" &&
			variant !== "warning"
		) {
			return undefined;
		}
		return {
			kind: "aside",
			variant,
			html: "",
		};
	}
	if (name === "Diagram") {
		return {
			kind: "diagram",
			id: attributes.id ?? "cms-diagram",
			title: attributes.title ?? "Diagram",
			description: attributes.description ?? "",
		};
	}
	if (INTERACTIVE_COMPONENTS.has(name)) return { kind: "interactive", name };
	if (name === "VideoPlayer") {
		const directId =
			attributes.video?.match(/^(?:["']?)([a-zA-Z0-9_-]{8,128})(?:["']?)$/)?.[1] ??
			"";
		const thumbnailVideoId = attributes.thumbnailUrl?.match(/getVideoThumbnailUrl\(["']([^"']+)/)?.[1];
		const videoId = directId || thumbnailVideoId;
		return videoId ? { kind: "video", videoId } : undefined;
	}
	if (name === "ThemeAwareImage") {
		const lightSrc = lookupImportedAsset(attributes.lightSrc, assets, imports);
		const darkSrc = lookupImportedAsset(attributes.darkSrc, assets, imports);
		if (!lightSrc || !darkSrc) return undefined;
		return {
			kind: "theme-image",
			lightSrc,
			darkSrc,
			alt: attributes.alt ?? "",
			...(attributes.class ? { className: attributes.class } : {}),
		};
	}
	if (name === "ZoomableImage") {
		const src = lookupImportedAsset(attributes.image, assets, imports);
		if (!src) return undefined;
		return { kind: "zoom-image", src, alt: attributes.alt ?? "" };
	}
	return undefined;
}

export async function parseSafeCmsBody(
	entry: Pick<PayloadEntry, "body" | "data" | "mediaAssets">,
): Promise<SafeBodyBlock[]> {
	const source = typeof entry.body === "string" ? entry.body : "";
	if (!source.trim()) return [];
	const assets = entry.mediaAssets ?? [];
	const marked = createMarkdownRenderer(assets);
	const { body, assetImports } = stripMdxImports(source);
	const blocks: SafeBodyBlock[] = [];
	const expression = customComponentPattern();
	let cursor = 0;
	for (const match of body.matchAll(expression)) {
		const offset = match.index ?? 0;
		if (offset > cursor) {
			await appendMarkdownAndDiagrams(
				blocks,
				body.slice(cursor, offset),
				marked,
			);
		}
		const name = match[1] ?? match[4];
		const attributes = match[2] ?? match[5] ?? "";
		const inner = match[3];
		if (name) {
			const component = componentBlock(
				name,
				attributes,
				inner,
				assets,
				assetImports,
			);
			if (component?.kind === "aside") {
				blocks.push({
					...component,
					html: await markdownToSafeHtml(inner ?? "", marked),
				});
			} else if (component?.kind === "diagram") {
				const source = d2Source(inner);
				blocks.push({
					...component,
					...(source ? { sourceHash: await sha256Hex(source) } : {}),
				});
			} else if (component) {
				blocks.push(component);
			}
		}
		cursor = offset + match[0].length;
	}
	if (cursor < body.length) {
		await appendMarkdownAndDiagrams(blocks, body.slice(cursor), marked);
	}
	return blocks;
}

export function getCmsBodyHeadings(body: string | undefined): Array<{
	depth: number;
	text: string;
	slug: string;
}> {
	if (!body) return [];
	return [...body.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map((match) => {
		const text = (match[2] ?? "").replace(/[*`_]/g, "").trim();
		const slug = text
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s-]/gu, "")
			.trim()
			.replace(/\s+/g, "-");
		return { depth: match[1]?.length ?? 1, text, slug };
	});
}
