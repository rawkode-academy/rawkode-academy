// A string renderer for Workers: no DOM, no Node APIs. Every node has a
// default rendering; the website overrides nodes (asides, diagrams, islands,
// code highlighting) through hooks that may be async, e.g. expressive-code.
import GithubSlugger from "github-slugger";
import { groupInline, type InlineTree, inlineText } from "./inline";
import {
	type AnyNode,
	type DocNode,
	type HeadingNode,
	type Mark,
	type MarkType,
	type NodeType,
	type TableCellNode,
	videoThumbnailUrl,
} from "./types";

type MaybePromise<T> = T | Promise<T>;

export interface HtmlContext {
	// The node's content, already rendered.
	children: string;
	// The default markup for this node, for hooks that only wrap it.
	renderDefault: () => string;
}

export type NodeRenderer<N> = (
	node: N,
	context: HtmlContext,
) => MaybePromise<string | undefined>;

export type MarkRenderer<M> = (mark: M, inner: string) => string | undefined;

export interface HtmlOptions {
	// Returning undefined falls back to the default rendering.
	nodes?: {
		[K in NodeType]?: NodeRenderer<Extract<AnyNode, { type: K }>>;
	};
	marks?: {
		[K in MarkType]?: MarkRenderer<Extract<Mark, { type: K }>>;
	};
}

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

// Script-capable URL schemes never reach an href or src. Browsers drop tabs
// and newlines anywhere in a URL and C0 controls or spaces around it, so
// "java\tscript:" is javascript: too; test the URL as the browser reads it.
export function safeUrl(url: string): string | null {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: see above
	const parsed = url.replace(/[\t\n\r]/g, "").replace(/^[\u0000-\u0020]+/, "");
	return /^(?:javascript|vbscript|data):/i.test(parsed) ? null : url;
}

function attributes(
	values: Record<string, string | number | boolean | null | undefined>,
): string {
	let out = "";
	for (const [name, value] of Object.entries(values)) {
		if (value === null || value === undefined || value === false) continue;
		out +=
			value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`;
	}
	return out;
}

function then<T, R>(value: MaybePromise<T>, fn: (value: T) => MaybePromise<R>) {
	return value instanceof Promise ? value.then(fn) : fn(value);
}

function all(values: MaybePromise<string>[]): MaybePromise<string[]> {
	return values.some((value) => value instanceof Promise)
		? Promise.all(values)
		: (values as string[]);
}

class Renderer {
	private slugger = new GithubSlugger();

	constructor(
		private options: HtmlOptions,
		root: AnyNode,
	) {
		// Stored ids win; generated ones (headings added in an editor) avoid them.
		visit(root, (node) => {
			if (node.type === "heading" && node.attrs.id)
				this.slugger.slug(node.attrs.id);
		});
	}

	render(node: AnyNode): MaybePromise<string> {
		if (node.type === "heading" && !node.attrs.id) {
			node = {
				...node,
				attrs: {
					...node.attrs,
					id: this.slugger.slug(inlineText(node.content)),
				},
			} satisfies HeadingNode;
		}
		const parts =
			node.type === "text" || node.type === "hardBreak"
				? []
				: this.content(node);
		return then(parts, (rendered) => {
			const children = rendered.join("");
			const renderDefault = () => this.default(node, children, rendered);
			const hook = this.options.nodes?.[node.type] as
				| NodeRenderer<AnyNode>
				| undefined;
			if (!hook) return renderDefault();
			return then(hook(node, { children, renderDefault }), (html) =>
				html === undefined ? renderDefault() : html,
			);
		});
	}

	// One rendered string per child (inline content renders as one part).
	private content(node: AnyNode): MaybePromise<string[]> {
		if (!("content" in node) || !node.content || node.type === "codeBlock") {
			return [];
		}
		if (node.type === "paragraph" || node.type === "heading") {
			return then(this.inline(groupInline(node.content)), (html) => [html]);
		}
		return all((node.content as AnyNode[]).map((child) => this.render(child)));
	}

	private inline(trees: InlineTree[]): MaybePromise<string> {
		return then(
			all(
				trees.map((tree) => {
					if (tree.kind === "leaf") return this.render(tree.node);
					return then(this.inline(tree.children), (inner) =>
						this.mark(tree.mark, inner),
					);
				}),
			),
			(parts) => parts.join(""),
		);
	}

	private mark(mark: Mark, inner: string): string {
		const hook = this.options.marks?.[mark.type] as
			| MarkRenderer<Mark>
			| undefined;
		const custom = hook?.(mark, inner);
		if (custom !== undefined) return custom;
		switch (mark.type) {
			case "link":
				return `<a${attributes({
					href: safeUrl(mark.attrs.href),
					target: mark.attrs.target,
					rel: mark.attrs.rel,
					class: mark.attrs.class,
					title: mark.attrs.title,
				})}>${inner}</a>`;
			case "bold":
				return `<strong>${inner}</strong>`;
			case "italic":
				return `<em>${inner}</em>`;
			case "strike":
				return `<del>${inner}</del>`;
			case "kbd":
				return `<kbd>${inner}</kbd>`;
			case "superscript":
				return `<sup>${inner}</sup>`;
			case "code":
				return `<code>${inner}</code>`;
		}
	}

	private default(node: AnyNode, children: string, parts: string[]): string {
		switch (node.type) {
			case "doc":
				return children;
			case "text": {
				const text = escapeHtml(node.text);
				const code = node.marks?.find((mark) => mark.type === "code");
				return code ? this.mark(code, text) : text;
			}
			case "hardBreak":
				return "<br>";
			case "paragraph":
				return `<p>${children}</p>`;
			case "heading":
				return `<h${node.attrs.level}${attributes({ id: node.attrs.id })}>${children}</h${node.attrs.level}>`;
			case "blockquote":
				return `<blockquote>${children}</blockquote>`;
			case "bulletList":
				return `<ul>${children}</ul>`;
			case "orderedList":
				return `<ol${attributes({
					start: node.attrs.start === 1 ? null : node.attrs.start,
					type: node.attrs.type,
				})}>${children}</ol>`;
			case "listItem":
				return `<li>${tight(node, parts)}</li>`;
			case "taskList":
				return `<ul class="contains-task-list">${children}</ul>`;
			case "taskItem":
				return `<li class="task-list-item"><input type="checkbox" disabled${node.attrs.checked ? " checked" : ""}> ${tight(node, parts)}</li>`;
			case "codeBlock": {
				const code = node.content?.[0]?.text ?? "";
				const pre = `<pre${attributes({
					"data-language": node.attrs.language,
					"data-meta": node.attrs.meta,
				})}><code${attributes({
					class: node.attrs.language ? `language-${node.attrs.language}` : null,
				})}>${escapeHtml(code)}</code></pre>`;
				return node.attrs.title
					? `<figure class="code-block"><figcaption>${escapeHtml(node.attrs.title)}</figcaption>${pre}</figure>`
					: pre;
			}
			case "horizontalRule":
				return "<hr>";
			case "table": {
				// Leading rows made only of header cells form <thead>, as in GFM.
				let head = 0;
				while (
					head < node.content.length &&
					node.content[head]!.content.length > 0 &&
					node.content[head]!.content.every((c) => c.type === "tableHeader")
				) {
					head++;
				}
				if (head === 0) return `<table><tbody>${children}</tbody></table>`;
				const body = parts.slice(head).join("");
				return `<table><thead>${parts.slice(0, head).join("")}</thead>${
					body ? `<tbody>${body}</tbody>` : ""
				}</table>`;
			}
			case "tableRow":
				return `<tr>${children}</tr>`;
			case "tableCell":
			case "tableHeader":
				return cell(node, parts);
			case "image": {
				const { src, alt, title, width, height, darkSrc, zoomable } =
					node.attrs;
				const img = `<img${attributes({
					src: safeUrl(src),
					alt: alt ?? "",
					title,
					width,
					height,
					loading: "lazy",
					decoding: "async",
					"data-zoomable": zoomable,
				})}>`;
				if (!darkSrc) return img;
				return `<picture><source${attributes({
					srcset: safeUrl(darkSrc),
					media: "(prefers-color-scheme: dark)",
				})}>${img}</picture>`;
			}
			case "aside":
				return `<aside${attributes({
					class: "aside",
					"data-variant": node.attrs.variant,
					"aria-label": node.attrs.variant,
				})}><p class="aside-label">${escapeHtml(node.attrs.variant)}</p>${children}</aside>`;
			case "diagram": {
				const { id, title, description, source, src, language } = node.attrs;
				const body = src
					? `<img${attributes({ src: safeUrl(src), alt: title ?? "Diagram", loading: "lazy" })}>`
					: `<pre><code class="language-${language}">${escapeHtml(source)}</code></pre>`;
				return `<figure${attributes({ class: "diagram", id })}>${body}${
					title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ""
				}${description ? `<p class="diagram-description">${escapeHtml(description)}</p>` : ""}</figure>`;
			}
			case "video": {
				const { videoId, thumbnailUrl } = node.attrs;
				return `<div${attributes({ class: "video", "data-video-id": videoId })}><img${attributes(
					{
						src: safeUrl(thumbnailUrl ?? videoThumbnailUrl(videoId)),
						alt: "Video thumbnail",
						loading: "lazy",
					},
				)}></div>`;
			}
			case "interactive":
				return `<div${attributes({
					"data-interactive": node.attrs.component,
					"data-hydrate": node.attrs.hydrate,
					"data-props": JSON.stringify(node.attrs.props),
				})}></div>`;
			case "embed":
				return `<iframe${attributes({
					src: safeUrl(node.attrs.src),
					title: node.attrs.title,
					width: node.attrs.width,
					height: node.attrs.height,
					allow: node.attrs.allow,
					allowfullscreen: node.attrs.allowFullscreen,
					loading: "lazy",
				})}></iframe>`;
		}
	}
}

const LISTS = new Set<NodeType>(["bulletList", "orderedList", "taskList"]);

// A list item holding one paragraph, optionally followed by nested lists,
// renders like a tight Markdown list item: `<li>text<ul>…</ul></li>`.
function tight(node: { content: AnyNode[] }, parts: string[]): string {
	const [first, ...rest] = node.content;
	// fromMarkdown adds an empty paragraph to items that start with another
	// block (an image, a code fence); it has nothing to show.
	if (first?.type === "paragraph" && !first.content?.length && rest.length) {
		return parts.slice(1).join("");
	}
	if (first?.type !== "paragraph" || rest.some((n) => !LISTS.has(n.type))) {
		return parts.join("");
	}
	return (
		(parts[0] ?? "").replace(/^<p>([\s\S]*)<\/p>$/, "$1") +
		parts.slice(1).join("")
	);
}

function cell(node: TableCellNode, parts: string[]): string {
	const tag = node.type === "tableHeader" ? "th" : "td";
	const { colspan, rowspan, align } = node.attrs;
	return `<${tag}${attributes({
		colspan: colspan === 1 ? null : colspan,
		rowspan: rowspan === 1 ? null : rowspan,
		align,
	})}>${tight(node, parts)}</${tag}>`;
}

function visit(node: AnyNode, fn: (node: AnyNode) => void) {
	fn(node);
	if ("content" in node && Array.isArray(node.content)) {
		for (const child of node.content as AnyNode[]) visit(child, fn);
	}
}

export function toHtml(
	node: DocNode | AnyNode,
	options: HtmlOptions = {},
): string {
	const html = new Renderer(options, node).render(node);
	if (html instanceof Promise) {
		throw new Error(
			"toHtml: a render hook returned a Promise; use toHtmlAsync",
		);
	}
	return html;
}

export async function toHtmlAsync(
	node: DocNode | AnyNode,
	options: HtmlOptions = {},
): Promise<string> {
	return new Renderer(options, node).render(node);
}
