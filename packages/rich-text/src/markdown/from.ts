import GithubSlugger from "github-slugger";
import type {
	Code,
	Heading,
	Html,
	List,
	Nodes,
	PhrasingContent,
	Root,
	RootContent,
	Table,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { inlineText, normaliseInline } from "../inline";
import {
	ASIDE_VARIANTS,
	type AsideVariant,
	type BlockNode,
	type CodeBlockNode,
	type DiagramNode,
	type DocNode,
	emptyDoc,
	HYDRATE_DIRECTIVES,
	type HydrateDirective,
	type ImageNode,
	INTERACTIVE_COMPONENTS,
	type InlineNode,
	type InteractiveComponent,
	type JsonValue,
	type LinkAttrs,
	type ListItemNode,
	type Mark,
	type ParagraphNode,
	type TableAlign,
	type TableCellNode,
	videoThumbnailUrl,
} from "../types";
import {
	COMPONENT_IMPORTS,
	type ComponentName,
	VIDEO_THUMBNAIL_IMPORT,
} from "./components";

export interface ResolvedAsset {
	src: string;
	width?: number | null;
	height?: number | null;
}

export interface AssetContext {
	file?: string;
	// The attribute the path came from: src, darkSrc, thumbnailUrl.
	attribute: string;
}

// Maps a local relative path (./cover.png, ../images/x.png) to its public URL,
// optionally with intrinsic dimensions.
export type AssetResolver = (
	path: string,
	context: AssetContext,
) => string | ResolvedAsset;

export interface DiagramSource {
	language: "d2";
	source: string;
	meta: string | null;
	id: string | null;
	title: string | null;
}

// Returns the URL of the rendered SVG, or null to leave src empty.
export type DiagramResolver = (
	diagram: DiagramSource,
	context: { file?: string },
) => string | null;

export interface FromMarkdownOptions {
	mdx: boolean;
	// true turns soft line breaks into hard breaks, as marked's `breaks` does
	// for video descriptions (YouTube text puts each chapter on its own line).
	// Otherwise a soft break is a space.
	breaks?: boolean;
	// Used in error messages and passed to the resolvers.
	file?: string;
	assetResolver?: AssetResolver;
	diagramResolver?: DiagramResolver;
}

export class RichTextError extends Error {
	constructor(
		message: string,
		readonly file: string | undefined,
		readonly line: number | undefined,
		readonly column: number | undefined,
	) {
		const where = [file ?? "<markdown>", line, column]
			.filter((part) => part !== undefined)
			.join(":");
		super(`${where}: ${message}`);
		this.name = "RichTextError";
	}
}

// Element names that are HTML. Any other inline tag in plain Markdown (e.g.
// the `Option<T>` in a video description) is text the author meant literally.
const HTML_ELEMENTS = new Set(
	"a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr".split(
		" ",
	),
);

// HTML (Markdown) and JSX (MDX) elements that map to marks.
const ELEMENT_MARKS: Record<string, Mark> = {
	kbd: { type: "kbd" },
	sup: { type: "superscript" },
};

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

type Binding =
	| { kind: "component"; name: ComponentName }
	| { kind: "asset"; path: string }
	| { kind: "videoThumbnail" };

class AssetRef {
	constructor(readonly path: string) {}
}

type Value = JsonValue | AssetRef | undefined;

// biome-ignore lint/suspicious/noExplicitAny: mdx/estree nodes are untyped here
type Any = any;

interface HtmlElement {
	type: "htmlElement";
	name: string;
	children: PhrasingContent[];
	position?: Nodes["position"];
}

class Converter {
	private bindings = new Map<string, Binding>();
	private slugger = new GithubSlugger();

	constructor(private options: FromMarkdownOptions) {}

	fail(message: string, node?: { position?: Nodes["position"] }): never {
		throw new RichTextError(
			message,
			this.options.file,
			node?.position?.start.line,
			node?.position?.start.column,
		);
	}

	doc(root: Root): DocNode {
		for (const node of root.children) {
			if (node.type === "mdxjsEsm") this.imports(node);
		}
		const content = this.blocks(root.children);
		return content.length > 0 ? { type: "doc", content } : emptyDoc();
	}

	private imports(node: Any) {
		const program = node.data?.estree;
		if (!program) this.fail("ESM without an estree", node);
		for (const statement of program.body) {
			if (statement.type !== "ImportDeclaration") {
				this.fail(`unsupported ESM statement ${statement.type}`, node);
			}
			const source: string = statement.source.value;
			for (const specifier of statement.specifiers) {
				const local: string = specifier.local.name;
				const imported =
					specifier.type === "ImportDefaultSpecifier"
						? "default"
						: specifier.type === "ImportSpecifier"
							? specifier.imported.name
							: "*";
				const component = COMPONENT_IMPORTS[source];
				if (component && imported === "default") {
					this.bindings.set(local, { kind: "component", name: component });
				} else if (
					source === VIDEO_THUMBNAIL_IMPORT &&
					imported === "getVideoThumbnailUrl"
				) {
					this.bindings.set(local, { kind: "videoThumbnail" });
				} else if (/^\.\.?\//.test(source) && imported === "default") {
					this.bindings.set(local, { kind: "asset", path: source });
				} else {
					this.fail(`unsupported import ${imported} from "${source}"`, node);
				}
			}
		}
	}

	blocks(nodes: RootContent[]): BlockNode[] {
		return nodes.flatMap((node) => this.block(node));
	}

	private block(node: RootContent): BlockNode[] {
		switch (node.type) {
			case "mdxjsEsm":
				return [];
			case "paragraph":
				return this.paragraph(node.children, node);
			case "heading":
				return [this.heading(node)];
			case "thematicBreak":
				return [{ type: "horizontalRule" }];
			case "blockquote":
				return [{ type: "blockquote", content: this.nonEmpty(node.children) }];
			case "list":
				return [this.list(node)];
			case "code":
				return [node.lang === "d2" ? this.diagram(node, {}) : this.code(node)];
			case "table":
				return [this.table(node)];
			case "mdxJsxFlowElement":
				return this.element(node);
			case "html":
				return this.fail(
					`unsupported HTML block ${JSON.stringify(node.value.slice(0, 60))}`,
					node,
				);
			default:
				return this.fail(`unsupported Markdown construct "${node.type}"`, node);
		}
	}

	// Blocks for content that must not be empty (blockquote, aside, cell).
	private nonEmpty(nodes: RootContent[]): BlockNode[] {
		const content = this.blocks(nodes);
		return content.length > 0 ? content : [{ type: "paragraph" }];
	}

	// A paragraph holding only images (or image components) becomes those
	// images as blocks: the schema's image is a block, like a figure.
	private paragraph(children: PhrasingContent[], node: Nodes): BlockNode[] {
		const isBlank = (child: PhrasingContent) =>
			(child.type === "text" && child.value.trim() === "") ||
			child.type === "break";
		const isBlock = (child: PhrasingContent) =>
			child.type === "image" ||
			(child.type === "mdxJsxTextElement" && this.isBlockComponent(child));
		if (children.some(isBlock)) {
			if (!children.every((child) => isBlock(child) || isBlank(child))) {
				this.fail("an image must be alone in its paragraph", node);
			}
			return children.filter(isBlock).flatMap((child) =>
				child.type === "image"
					? [
							this.image(child, {
								src: child.url,
								alt: child.alt || null,
								title: child.title ?? null,
							}),
						]
					: this.element(child),
			);
		}
		const content = this.inline(children, []);
		const paragraph: ParagraphNode = { type: "paragraph" };
		if (content.length > 0) paragraph.content = content;
		return [paragraph];
	}

	private heading(node: Heading): BlockNode {
		const content = this.inline(node.children, []);
		return {
			type: "heading",
			attrs: { level: node.depth, id: this.slugger.slug(inlineText(content)) },
			...(content.length > 0 ? { content } : {}),
		};
	}

	private list(node: List): BlockNode {
		const tasks = node.children.filter(
			(item) => typeof item.checked === "boolean",
		);
		if (tasks.length > 0 && tasks.length !== node.children.length) {
			this.fail("a list mixes task items and plain items", node);
		}
		const items = node.children.map((item) => {
			const content = this.blocks(item.children);
			if (content[0]?.type !== "paragraph")
				content.unshift({ type: "paragraph" });
			return content as ListItemNode["content"];
		});
		if (tasks.length > 0) {
			if (node.ordered) this.fail("ordered task lists are not supported", node);
			return {
				type: "taskList",
				content: items.map((content, i) => ({
					type: "taskItem",
					attrs: { checked: node.children[i]!.checked === true },
					content,
				})),
			};
		}
		const listItems: ListItemNode[] = items.map((content) => ({
			type: "listItem",
			content,
		}));
		return node.ordered
			? {
					type: "orderedList",
					attrs: { start: node.start ?? 1, type: null },
					content: listItems,
				}
			: { type: "bulletList", content: listItems };
	}

	private code(node: Code): CodeBlockNode {
		const { title, meta } = parseCodeMeta(node.meta ?? null);
		return {
			type: "codeBlock",
			attrs: { language: node.lang ?? null, title, meta },
			...(node.value ? { content: [{ type: "text", text: node.value }] } : {}),
		};
	}

	private diagram(
		node: Code,
		props: {
			id?: string | null;
			title?: string | null;
			description?: string | null;
			src?: string | null;
		},
	): DiagramNode {
		const source: DiagramSource = {
			language: "d2",
			source: node.value,
			meta: node.meta ?? null,
			id: props.id ?? null,
			title: props.title ?? null,
		};
		return {
			type: "diagram",
			attrs: {
				id: source.id,
				title: source.title,
				description: props.description ?? null,
				language: "d2",
				source: source.source,
				meta: source.meta,
				src:
					props.src ??
					this.options.diagramResolver?.(source, { file: this.options.file }) ??
					null,
			},
		};
	}

	private table(node: Table): BlockNode {
		const align = node.align ?? [];
		return {
			type: "table",
			content: node.children.map((row, r) => ({
				type: "tableRow",
				content: row.children.map(
					(cell, c): TableCellNode => ({
						type: r === 0 ? "tableHeader" : "tableCell",
						attrs: {
							colspan: 1,
							rowspan: 1,
							colwidth: null,
							align: (align[c] ?? null) as TableAlign | null,
						},
						content: this.paragraph(cell.children, cell),
					}),
				),
			})),
		};
	}

	inline(children: PhrasingContent[], marks: Mark[]): InlineNode[] {
		const out: InlineNode[] = [];
		const nodes = this.options.mdx ? children : this.pairHtml(children);
		for (const node of nodes as (PhrasingContent | HtmlElement)[]) {
			out.push(...this.phrasing(node, marks));
		}
		return normaliseInline(out);
	}

	private phrasing(
		node: PhrasingContent | HtmlElement,
		marks: Mark[],
	): InlineNode[] {
		switch (node.type) {
			case "text": {
				// Soft line breaks are whitespace (or, with `breaks`, hard breaks);
				// the editor has no such concept.
				if (!this.options.breaks)
					return [text(node.value.replace(/\n/g, " "), marks)];
				return node.value
					.split("\n")
					.flatMap((line, i): InlineNode[] =>
						i === 0
							? [text(line, marks)]
							: [{ type: "hardBreak" }, text(line, marks)],
					);
			}
			case "inlineCode":
				// CommonMark: a line ending inside a code span is a space.
				return [
					text(node.value.replace(/\n/g, " "), [...marks, { type: "code" }]),
				];
			case "strong":
				return this.inline(node.children, [...marks, { type: "bold" }]);
			case "emphasis":
				return this.inline(node.children, [...marks, { type: "italic" }]);
			case "delete":
				return this.inline(node.children, [...marks, { type: "strike" }]);
			case "break":
				return [{ type: "hardBreak" }];
			case "link": {
				const attrs: LinkAttrs = {
					href: node.url,
					target: null,
					rel: null,
					class: null,
					title: node.title ?? null,
				};
				if (marks.some((mark) => mark.type === "link"))
					this.fail("nested links", node);
				return this.inline(node.children, [...marks, { type: "link", attrs }]);
			}
			case "htmlElement": {
				const mark = ELEMENT_MARKS[node.name]!;
				return this.inline(node.children, [...marks, mark]);
			}
			case "html":
				return this.inlineHtml(node, marks);
			case "mdxJsxTextElement": {
				const mark = ELEMENT_MARKS[node.name ?? ""];
				if (mark && node.attributes.length === 0) {
					return this.inline(node.children, [...marks, mark]);
				}
				if (node.name === "br" && node.children.length === 0)
					return [{ type: "hardBreak" }];
				return this.fail(`unsupported inline element <${node.name}>`, node);
			}
			case "image":
				return this.fail("an image must be alone in its paragraph", node);
			default:
				return this.fail(`unsupported inline construct "${node.type}"`, node);
		}
	}

	private inlineHtml(node: Html, marks: Mark[]): InlineNode[] {
		const tag = node.value.match(/^<\/?([A-Za-z][\w-]*)\b[^>]*?\/?>$/);
		if (tag && !HTML_ELEMENTS.has(tag[1]!.toLowerCase()))
			return [text(node.value, marks)];
		if (/^<br\s*\/?>$/i.test(node.value)) return [{ type: "hardBreak" }];
		return this.fail(
			`unsupported inline HTML ${JSON.stringify(node.value)}`,
			node,
		);
	}

	// Inline HTML arrives as separate open/close nodes around its content;
	// pair <sup>…</sup> and <kbd>…</kbd> into one element.
	private pairHtml(
		children: PhrasingContent[],
	): (PhrasingContent | HtmlElement)[] {
		const out: (PhrasingContent | HtmlElement)[] = [];
		for (let i = 0; i < children.length; i++) {
			const node = children[i]!;
			const open =
				node.type === "html" ? node.value.match(/^<([a-z]+)>$/i) : null;
			const name = open?.[1]?.toLowerCase();
			if (!name || !(name in ELEMENT_MARKS)) {
				out.push(node);
				continue;
			}
			let depth = 1;
			let j = i + 1;
			for (; j < children.length; j++) {
				const candidate = children[j]!;
				if (candidate.type !== "html") continue;
				const value = candidate.value.toLowerCase();
				if (value === `<${name}>`) depth++;
				if (value === `</${name}>` && --depth === 0) break;
			}
			if (j === children.length) this.fail(`unclosed <${name}>`, node);
			out.push({
				type: "htmlElement",
				name,
				children: children.slice(i + 1, j),
				position: node.position,
			});
			i = j;
		}
		return out;
	}

	private isBlockComponent(node: Any): boolean {
		const binding = this.bindings.get(node.name ?? "");
		return (
			node.name === "img" ||
			(binding?.kind === "component" &&
				["ZoomableImage", "ThemeAwareImage"].includes(binding.name))
		);
	}

	private image(
		node: Nodes,
		attrs: {
			src: Value;
			alt: string | null;
			title: string | null;
			width?: number | null;
			height?: number | null;
			darkSrc?: Value;
			zoomable?: boolean;
		},
	): ImageNode {
		const src = this.asset(attrs.src, "src", node);
		const dark =
			attrs.darkSrc === undefined
				? null
				: this.asset(attrs.darkSrc, "darkSrc", node);
		return {
			type: "image",
			attrs: {
				src: src.src,
				alt: attrs.alt,
				title: attrs.title,
				width: attrs.width ?? src.width ?? null,
				height: attrs.height ?? src.height ?? null,
				darkSrc: dark?.src ?? null,
				zoomable: attrs.zoomable ?? false,
			},
		};
	}

	private asset(value: Value, attribute: string, node: Nodes): ResolvedAsset {
		const path = value instanceof AssetRef ? value.path : value;
		if (typeof path !== "string" || path === "") {
			this.fail(`${attribute} must be a URL or an imported asset`, node);
		}
		if (ABSOLUTE_URL.test(path)) return { src: path };
		const resolver = this.options.assetResolver;
		if (!resolver)
			this.fail(`relative asset "${path}" needs an assetResolver`, node);
		const resolved = resolver(path, { file: this.options.file, attribute });
		return typeof resolved === "string" ? { src: resolved } : resolved;
	}

	// MDX elements: the website's components (by their import) and the few
	// intrinsic elements the content uses.
	private element(node: Any): BlockNode[] {
		const name: string = node.name ?? "";
		const binding = this.bindings.get(name);
		const component =
			binding?.kind === "component"
				? binding.name
				: /^[a-z]/.test(name)
					? name
					: undefined;
		if (!component)
			this.fail(`<${name}> is not imported from a known component`, node);
		const props = new Props(this, node);

		switch (component) {
			case "Aside": {
				const variant = props.string("variant", true) as AsideVariant;
				if (!ASIDE_VARIANTS.includes(variant))
					this.fail(`Aside variant "${variant}"`, node);
				props.done();
				return [
					{
						type: "aside",
						attrs: { variant },
						content: this.nonEmpty(node.children),
					},
				];
			}
			case "Diagram": {
				const attrs = {
					id: props.string("id"),
					title: props.string("title"),
					description: props.string("description"),
					src: props.string("src"),
				};
				props.done();
				const children = node.children as RootContent[];
				const [code, ...rest] = children;
				if (rest.length > 0 || code?.type !== "code" || code.lang !== "d2") {
					this.fail("<Diagram> must wrap exactly one ```d2 block", node);
				}
				return [this.diagram(code, attrs)];
			}
			case "ZoomableImage":
			case "ThemeAwareImage":
			case "img": {
				const image =
					component === "ZoomableImage"
						? {
								src: props.value("image", true),
								alt: props.string("alt"),
								title: props.string("title"),
								width: props.number("width"),
								height: props.number("height"),
								zoomable: true,
							}
						: component === "ThemeAwareImage"
							? {
									src: props.value("lightSrc", true),
									darkSrc: props.value("darkSrc", true),
									alt: props.string("alt"),
									title: props.string("title"),
									width: props.number("width"),
									height: props.number("height"),
									zoomable: props.boolean("zoomable"),
								}
							: {
									src: props.value("src", true),
									alt: props.string("alt"),
									title: props.string("title"),
									width: props.number("width"),
									height: props.number("height"),
								};
				// Presentation-only: the website styles images itself.
				props.ignore("class", "loading");
				props.done();
				this.noChildren(node);
				return [this.image(node, image)];
			}
			case "VideoPlayer": {
				const videoId = props.string("video", true)!;
				const thumbnail = props.value("thumbnailUrl");
				props.ignore("client:only");
				props.done();
				this.noChildren(node);
				const thumbnailUrl =
					thumbnail === undefined
						? null
						: this.asset(thumbnail, "thumbnailUrl", node).src;
				return [
					{
						type: "video",
						attrs: {
							videoId,
							thumbnailUrl:
								thumbnailUrl === videoThumbnailUrl(videoId)
									? null
									: thumbnailUrl,
						},
					},
				];
			}
			case "iframe": {
				const allowFullscreen =
					props.boolean("allowfullscreen") || props.boolean("allowFullScreen");
				const embed = {
					src: props.string("src", true)!,
					title: props.string("title"),
					width: props.number("width"),
					height: props.number("height"),
					allow: props.string("allow"),
					allowFullscreen,
				};
				props.ignore("frameborder", "frameBorder", "loading");
				props.done();
				this.noChildren(node);
				return [{ type: "embed", attrs: embed }];
			}
			default: {
				if (
					!INTERACTIVE_COMPONENTS.includes(component as InteractiveComponent)
				) {
					return this.fail(`unsupported element <${name}>`, node);
				}
				const hydrate = props.directive() ?? "visible";
				this.noChildren(node);
				return [
					{
						type: "interactive",
						attrs: {
							component: component as InteractiveComponent,
							props: props.rest(),
							hydrate,
						},
					},
				];
			}
		}
	}

	private noChildren(node: Any) {
		if (node.children.length > 0)
			this.fail(`<${node.name}> takes no children`, node);
	}

	evaluate(expression: Any, node: Nodes): Value {
		switch (expression.type) {
			case "Literal":
				return expression.value;
			case "TemplateLiteral":
				if (expression.expressions.length > 0) break;
				return expression.quasis[0].value.cooked;
			case "UnaryExpression":
				if (
					expression.operator === "-" &&
					expression.argument.type === "Literal"
				) {
					return -expression.argument.value;
				}
				break;
			case "ArrayExpression":
				return expression.elements.map((element: Any) =>
					this.json(element, node),
				);
			case "ObjectExpression":
				return Object.fromEntries(
					expression.properties.map((property: Any) => {
						if (property.type !== "Property" || property.computed) {
							this.fail("unsupported object property in JSX attribute", node);
						}
						const key =
							property.key.type === "Identifier"
								? property.key.name
								: property.key.value;
						return [key, this.json(property.value, node)];
					}),
				);
			case "Identifier": {
				const binding = this.bindings.get(expression.name);
				if (binding?.kind === "asset") return new AssetRef(binding.path);
				break;
			}
			case "ImportExpression":
				if (expression.source.type === "Literal")
					return new AssetRef(expression.source.value);
				break;
			case "CallExpression": {
				const binding = this.bindings.get(expression.callee.name ?? "");
				const [argument] = expression.arguments;
				if (
					binding?.kind === "videoThumbnail" &&
					expression.arguments.length === 1 &&
					argument.type === "Literal"
				) {
					return videoThumbnailUrl(argument.value);
				}
				break;
			}
		}
		return this.fail(
			`unsupported JSX attribute expression (${expression.type})`,
			node,
		);
	}

	private json(expression: Any, node: Nodes): JsonValue {
		const value = this.evaluate(expression, node);
		if (value instanceof AssetRef || value === undefined) {
			this.fail("only JSON values are supported here", node);
		}
		return value;
	}
}

// JSX attributes of one element; every attribute must be consumed or ignored
// explicitly, so a new prop fails the conversion instead of vanishing.
class Props {
	private values = new Map<string, Value>();

	constructor(
		private converter: Converter,
		private node: Any,
	) {
		for (const attribute of node.attributes) {
			if (attribute.type !== "mdxJsxAttribute") {
				converter.fail("spread attributes are not supported", node);
			}
			const value = attribute.value;
			this.values.set(
				attribute.name,
				value === null || value === undefined
					? true
					: typeof value === "string"
						? value
						: converter.evaluate(value.data.estree.body[0].expression, node),
			);
		}
	}

	private take(name: string, required: boolean): Value {
		if (!this.values.has(name)) {
			if (required)
				this.converter.fail(`<${this.node.name}> needs ${name}`, this.node);
			return undefined;
		}
		const value = this.values.get(name);
		this.values.delete(name);
		return value;
	}

	value(name: string, required = false): Value {
		return this.take(name, required);
	}

	string(name: string, required = false): string | null {
		const value = this.take(name, required);
		if (value === undefined) return null;
		if (typeof value !== "string")
			this.converter.fail(`${name} must be a string`, this.node);
		return value;
	}

	number(name: string): number | null {
		const value = this.take(name, false);
		if (value === undefined) return null;
		const number = typeof value === "string" ? Number(value) : value;
		if (typeof number !== "number" || !Number.isFinite(number)) {
			this.converter.fail(`${name} must be a number`, this.node);
		}
		return number;
	}

	boolean(name: string): boolean {
		const value = this.take(name, false);
		if (value === undefined) return false;
		if (value === true || value === "" || value === "true") return true;
		if (value === false || value === "false") return false;
		return this.converter.fail(`${name} must be a boolean`, this.node);
	}

	directive(): HydrateDirective | undefined {
		let found: HydrateDirective | undefined;
		for (const name of [...this.values.keys()]) {
			const match = name.match(/^client:(.+)$/);
			if (!match) continue;
			if (found || !HYDRATE_DIRECTIVES.includes(match[1] as HydrateDirective)) {
				this.converter.fail(`unsupported directive ${name}`, this.node);
			}
			found = match[1] as HydrateDirective;
			this.values.delete(name);
		}
		return found;
	}

	ignore(...names: string[]) {
		for (const name of names) this.values.delete(name);
	}

	rest(): { [key: string]: JsonValue } {
		const out: { [key: string]: JsonValue } = {};
		for (const [name, value] of this.values) {
			if (value instanceof AssetRef || value === undefined) {
				this.converter.fail(`${name} must be a JSON value`, this.node);
			}
			out[name] = value;
		}
		this.values.clear();
		return out;
	}

	done() {
		const left = [...this.values.keys()];
		if (left.length > 0) {
			this.converter.fail(
				`<${this.node.name}> has unsupported props: ${left.join(", ")}`,
				this.node,
			);
		}
	}
}

function text(value: string, marks: Mark[]): InlineNode {
	return marks.length > 0
		? { type: "text", text: value, marks: [...marks] }
		: { type: "text", text: value };
}

const TITLE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)')(?=\s|$)/;

// Expressive-code meta: title="x.ts" becomes its own attribute, the rest of
// the meta string is kept as written.
export function parseCodeMeta(meta: string | null): {
	title: string | null;
	meta: string | null;
} {
	if (!meta) return { title: null, meta: null };
	const match = meta.match(TITLE);
	if (!match) return { title: null, meta: meta.trim() || null };
	const rest = (
		meta.slice(0, match.index) + meta.slice(match.index! + match[0].length)
	)
		.replace(/\s+/g, " ")
		.trim();
	return { title: match[1] ?? match[2] ?? null, meta: rest || null };
}

export function parseMarkdown(markdown: string, mdx: boolean): Root {
	const processor = unified().use(remarkParse).use(remarkGfm);
	if (mdx) processor.use(remarkMdx);
	return processor.parse(markdown) as Root;
}

export function fromMarkdown(
	markdown: string,
	options: FromMarkdownOptions,
): DocNode {
	let root: Root;
	try {
		root = parseMarkdown(markdown, options.mdx);
	} catch (error) {
		const cause = error as {
			line?: number;
			column?: number;
			reason?: string;
			message: string;
		};
		throw new RichTextError(
			cause.reason ?? cause.message,
			options.file,
			cause.line,
			cause.column,
		);
	}
	return new Converter(options).doc(root);
}
