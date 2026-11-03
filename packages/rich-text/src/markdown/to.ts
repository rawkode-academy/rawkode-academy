import type {
	BlockContent,
	ListItem,
	Paragraph,
	PhrasingContent,
	Root,
	RootContent,
	TableCell,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { groupInline, type InlineTree } from "../inline";
import type {
	BlockNode,
	DocNode,
	ImageNode,
	InlineNode,
	ListItemNode,
	TableCellNode,
	TaskItemNode,
} from "../types";
import {
	COMPONENT_SOURCES,
	type ComponentName,
	VIDEO_THUMBNAIL_IMPORT,
} from "./components";

export interface ToMarkdownOptions {
	// true writes MDX: custom nodes become the website's components (with their
	// imports), so fromMarkdown(..., { mdx: true }) gives the same document.
	// false (default) writes portable Markdown for YouTube, social posts and
	// LLM prompts: asides become blockquotes, diagrams an image or a d2 fence,
	// embeds a link; videos and interactive islands have no Markdown form and
	// are left out, as are image dimensions and dark-mode variants.
	mdx?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: mdx mdast nodes are not in @types/mdast's content unions
type Any = any;

type Attribute = string | number | boolean | null | { expression: string };

class Writer {
	readonly imports = new Set<ComponentName | "getVideoThumbnailUrl">();

	constructor(private mdx: boolean) {}

	blocks(nodes: BlockNode[]): RootContent[] {
		return nodes.flatMap((node) => this.block(node));
	}

	private block(node: BlockNode): RootContent[] {
		switch (node.type) {
			case "paragraph":
				return [{ type: "paragraph", children: this.inline(node.content) }];
			case "heading":
				return [
					{
						type: "heading",
						depth: node.attrs.level,
						children: this.inline(node.content),
					},
				];
			case "blockquote":
				return [
					{
						type: "blockquote",
						children: this.blocks(node.content) as BlockContent[],
					},
				];
			case "bulletList":
			case "orderedList":
			case "taskList":
				return [
					{
						type: "list",
						ordered: node.type === "orderedList",
						start: node.type === "orderedList" ? node.attrs.start : null,
						spread: false,
						children: (node.content as (ListItemNode | TaskItemNode)[]).map(
							(item) => this.listItem(item),
						),
					},
				];
			case "codeBlock":
				return [
					{
						type: "code",
						lang: node.attrs.language,
						meta: codeMeta(node.attrs.title, node.attrs.meta),
						value: node.content?.[0]?.text ?? "",
					},
				];
			case "horizontalRule":
				return [{ type: "thematicBreak" }];
			case "table": {
				const [first] = node.content;
				return [
					{
						type: "table",
						align: (first?.content ?? []).map((cell) => cell.attrs.align),
						children: node.content.map((row) => ({
							type: "tableRow",
							children: row.content.map((cell) => this.cell(cell)),
						})),
					},
				];
			}
			case "image":
				return [this.image(node)];
			case "aside":
				if (this.mdx) {
					return [
						this.element(
							"Aside",
							{ variant: node.attrs.variant },
							this.blocks(node.content),
						),
					];
				}
				return [
					{
						type: "blockquote",
						children: [
							{
								type: "paragraph",
								children: [
									{
										type: "strong",
										children: [
											{ type: "text", value: label(node.attrs.variant) },
										],
									},
								],
							},
							...(this.blocks(node.content) as BlockContent[]),
						],
					},
				];
			case "diagram": {
				const { id, title, description, source, meta, src } = node.attrs;
				const code: RootContent = {
					type: "code",
					lang: "d2",
					meta,
					value: source,
				};
				if (this.mdx) {
					if (
						id === null &&
						title === null &&
						description === null &&
						src === null
					)
						return [code];
					return [
						this.element("Diagram", { id, title, description, src }, [code]),
					];
				}
				if (src) {
					return [
						{
							type: "paragraph",
							children: [
								{
									type: "image",
									url: src,
									alt: title ?? "Diagram",
									title: description,
								},
							],
						},
					];
				}
				return [code];
			}
			case "video":
				if (!this.mdx) return [];
				this.imports.add("getVideoThumbnailUrl");
				return [
					this.element("VideoPlayer", {
						"client:only": "vue",
						video: node.attrs.videoId,
						thumbnailUrl: node.attrs.thumbnailUrl ?? {
							expression: `getVideoThumbnailUrl(${JSON.stringify(node.attrs.videoId)})`,
						},
					}),
				];
			case "interactive": {
				if (!this.mdx) return [];
				const props: Record<string, Attribute> = {
					[`client:${node.attrs.hydrate}`]: true,
				};
				for (const [key, value] of Object.entries(node.attrs.props)) {
					props[key] =
						typeof value === "string"
							? value
							: { expression: JSON.stringify(value) };
				}
				return [this.element(node.attrs.component, props)];
			}
			case "embed": {
				const { src, title, width, height, allow, allowFullscreen } =
					node.attrs;
				if (this.mdx) {
					return [
						this.element("iframe", {
							src,
							title,
							width,
							height,
							allow,
							allowFullScreen: allowFullscreen || null,
						}),
					];
				}
				return [
					{
						type: "paragraph",
						children: [
							{
								type: "link",
								url: src,
								children: [{ type: "text", value: title ?? src }],
							},
						],
					},
				];
			}
		}
	}

	private listItem(item: ListItemNode | TaskItemNode): ListItem {
		let content: BlockNode[] = item.content;
		// fromMarkdown adds an empty paragraph when an item starts with another
		// block; drop it again so the Markdown matches the source.
		if (
			content.length > 1 &&
			content[0]?.type === "paragraph" &&
			!content[0].content
		) {
			content = content.slice(1);
		}
		const children = this.blocks(content) as BlockContent[];
		return {
			type: "listItem",
			checked: item.type === "taskItem" ? item.attrs.checked : null,
			spread: children.length > 1,
			children:
				children.length === 1 && isEmptyParagraph(children[0]!) ? [] : children,
		};
	}

	private cell(cell: TableCellNode): TableCell {
		const [block, ...rest] = cell.content;
		if (
			rest.length > 0 ||
			!block ||
			!["paragraph", "image"].includes(block.type)
		) {
			throw new Error(
				"toMarkdown: a table cell must hold one paragraph to be written as GFM",
			);
		}
		const children =
			block.type === "paragraph"
				? this.inline(block.content)
				: ((this.image(block as ImageNode) as Paragraph).children ?? []);
		return { type: "tableCell", children };
	}

	private image(node: ImageNode): RootContent {
		const { src, alt, title, width, height, darkSrc, zoomable } = node.attrs;
		if (this.mdx && darkSrc) {
			return this.element("ThemeAwareImage", {
				lightSrc: src,
				darkSrc,
				alt,
				title,
				width,
				height,
				zoomable: zoomable || null,
			});
		}
		// width/height are not props of the website's components; they are
		// written so the stored dimensions survive the round trip.
		if (this.mdx && zoomable) {
			return this.element("ZoomableImage", {
				image: src,
				alt,
				title,
				width,
				height,
			});
		}
		if (this.mdx && (width !== null || height !== null)) {
			return this.element("img", { src, alt, title, width, height });
		}
		return {
			type: "paragraph",
			children: [{ type: "image", url: src, alt: alt ?? "", title }],
		};
	}

	private element(
		name: string,
		attributes: Record<string, Attribute>,
		children: RootContent[] = [],
	): RootContent {
		if (/^[A-Z]/.test(name)) this.imports.add(name as ComponentName);
		return {
			type: "mdxJsxFlowElement",
			name,
			attributes: Object.entries(attributes)
				.filter(([, value]) => value !== null && value !== false)
				.map(([key, value]) => ({
					type: "mdxJsxAttribute",
					name: key,
					value:
						value === true
							? null
							: typeof value === "object"
								? {
										type: "mdxJsxAttributeValueExpression",
										value: value!.expression,
									}
								: typeof value === "number"
									? {
											type: "mdxJsxAttributeValueExpression",
											value: String(value),
										}
									: value,
				})),
			children,
		} as Any;
	}

	inline(content: InlineNode[] = []): PhrasingContent[] {
		// A trailing hard break (Shift+Enter at the end of a paragraph) has no
		// Markdown form: "a\\" would read back as a literal backslash.
		let end = content.length;
		while (end > 0 && content[end - 1]?.type === "hardBreak") end--;
		return this.trees(groupInline(content.slice(0, end)));
	}

	private trees(trees: InlineTree[]): PhrasingContent[] {
		return trees.flatMap((tree): PhrasingContent[] => {
			if (tree.kind === "leaf") {
				const node = tree.node;
				if (node.type === "hardBreak") return [{ type: "break" }];
				return node.marks?.some((mark) => mark.type === "code")
					? [{ type: "inlineCode", value: node.text }]
					: [{ type: "text", value: node.text }];
			}
			const children = this.trees(tree.children);
			const mark = tree.mark;
			switch (mark.type) {
				case "link":
					return [
						{
							type: "link",
							url: mark.attrs.href,
							title: mark.attrs.title,
							children,
						},
					];
				case "bold":
					return [{ type: "strong", children }];
				case "italic":
					return [{ type: "emphasis", children }];
				case "strike":
					return [{ type: "delete", children }];
				case "kbd":
				case "superscript": {
					const tag = mark.type === "kbd" ? "kbd" : "sup";
					if (this.mdx) {
						return [
							{
								type: "mdxJsxTextElement",
								name: tag,
								attributes: [],
								children,
							} as Any,
						];
					}
					return [
						{ type: "html", value: `<${tag}>` },
						...children,
						{ type: "html", value: `</${tag}>` },
					];
				}
				default:
					// code marks are leaves (see groupInline), never groups.
					return children;
			}
		});
	}

	esm(): RootContent | null {
		if (!this.mdx || this.imports.size === 0) return null;
		const lines = [...this.imports]
			.sort()
			.map((name) =>
				name === "getVideoThumbnailUrl"
					? `import { getVideoThumbnailUrl } from "${VIDEO_THUMBNAIL_IMPORT}";`
					: `import ${name} from "${COMPONENT_SOURCES[name]}";`,
			);
		return { type: "mdxjsEsm", value: lines.join("\n") } as Any;
	}
}

function isEmptyParagraph(node: RootContent): boolean {
	return node.type === "paragraph" && node.children.length === 0;
}

function label(variant: string): string {
	return `${variant.charAt(0).toUpperCase()}${variant.slice(1)}:`;
}

export function codeMeta(
	title: string | null,
	meta: string | null,
): string | null {
	if (title === null) return meta;
	if (title.includes('"') && title.includes("'")) {
		throw new Error(
			`toMarkdown: code title ${JSON.stringify(title)} has both quote kinds`,
		);
	}
	const quoted = title.includes('"') ? `'${title}'` : `"${title}"`;
	return [`title=${quoted}`, meta].filter(Boolean).join(" ");
}

export function toMdast(doc: DocNode, options: ToMarkdownOptions = {}): Root {
	const writer = new Writer(options.mdx ?? false);
	const children = writer
		.blocks(doc.content)
		.filter((node) => !isEmptyParagraph(node));
	const esm = writer.esm();
	return { type: "root", children: esm ? [esm, ...children] : children };
}

export function toMarkdown(
	doc: DocNode,
	options: ToMarkdownOptions = {},
): string {
	const processor = unified().use(remarkGfm);
	if (options.mdx) processor.use(remarkMdx);
	processor.use(remarkStringify, {
		bullet: "-",
		emphasis: "_",
		strong: "*",
		fence: "`",
		fences: true,
		rule: "-",
		listItemIndent: "one",
		resourceLink: true,
	});
	return String(processor.stringify(toMdast(doc, options)));
}
