// The stored document format: TipTap/ProseMirror JSON. These types mirror the
// schema in schema.ts exactly (every attribute is always present, as
// ProseMirror's Node.toJSON() writes it), so a stored document round-trips
// through Node.fromJSON(schema, doc).toJSON() unchanged.

export const ASIDE_VARIANTS = [
	"tip",
	"caution",
	"danger",
	"info",
	"warning",
] as const;
export type AsideVariant = (typeof ASIDE_VARIANTS)[number];

// React islands under website/src/components/articles/cgroups. None take props
// today, but the node keeps a props object so new islands need no schema change.
export const INTERACTIVE_COMPONENTS = [
	"CgroupTimeline",
	"CgroupTreeDiagram",
	"HierarchyExplorer",
	"PodCgroupMapper",
	"ResourceSimulator",
] as const;
export type InteractiveComponent = (typeof INTERACTIVE_COMPONENTS)[number];

// Astro client directives (client:load, client:visible, ...).
export const HYDRATE_DIRECTIVES = [
	"load",
	"idle",
	"visible",
	"media",
	"only",
] as const;
export type HydrateDirective = (typeof HYDRATE_DIRECTIVES)[number];

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface LinkAttrs {
	href: string;
	target: string | null;
	rel: string | null;
	class: string | null;
	title: string | null;
}

export type Mark =
	| { type: "link"; attrs: LinkAttrs }
	| { type: "bold" }
	| { type: "italic" }
	| { type: "strike" }
	| { type: "kbd" }
	| { type: "superscript" }
	| { type: "code" };

export type MarkType = Mark["type"];

// Canonical mark order, outermost first. It is the schema's mark order, which
// ProseMirror sorts marks by, and the nesting order toHtml/toMarkdown prefer.
export const MARK_ORDER: readonly MarkType[] = [
	"link",
	"bold",
	"italic",
	"strike",
	"kbd",
	"superscript",
	"code",
];

export interface TextNode {
	type: "text";
	text: string;
	marks?: Mark[];
}

export interface HardBreakNode {
	type: "hardBreak";
}

export type InlineNode = TextNode | HardBreakNode;

export interface ParagraphNode {
	type: "paragraph";
	content?: InlineNode[];
}

export interface HeadingNode {
	type: "heading";
	attrs: { level: 1 | 2 | 3 | 4 | 5 | 6; id: string | null };
	content?: InlineNode[];
}

export interface BlockquoteNode {
	type: "blockquote";
	content: BlockNode[];
}

export interface ListItemNode {
	type: "listItem";
	content: [ParagraphNode, ...BlockNode[]];
}

export interface BulletListNode {
	type: "bulletList";
	content: ListItemNode[];
}

export interface OrderedListNode {
	type: "orderedList";
	attrs: { start: number; type: string | null };
	content: ListItemNode[];
}

export interface TaskItemNode {
	type: "taskItem";
	attrs: { checked: boolean };
	content: [ParagraphNode, ...BlockNode[]];
}

export interface TaskListNode {
	type: "taskList";
	content: TaskItemNode[];
}

export interface CodeBlockNode {
	type: "codeBlock";
	// title is expressive-code's title="..." meta; meta keeps the rest verbatim
	// (frame="terminal", {1,3}, ins=..., and so on).
	attrs: { language: string | null; title: string | null; meta: string | null };
	content?: [TextNode];
}

export interface HorizontalRuleNode {
	type: "horizontalRule";
}

export type TableAlign = "left" | "center" | "right";

export interface TableCellAttrs {
	colspan: number;
	rowspan: number;
	colwidth: number[] | null;
	align: TableAlign | null;
}

export interface TableCellNode {
	type: "tableCell" | "tableHeader";
	attrs: TableCellAttrs;
	content: BlockNode[];
}

export interface TableRowNode {
	type: "tableRow";
	content: TableCellNode[];
}

export interface TableNode {
	type: "table";
	content: TableRowNode[];
}

export interface ImageNode {
	type: "image";
	attrs: {
		src: string;
		alt: string | null;
		title: string | null;
		width: number | null;
		height: number | null;
		// ThemeAwareImage: src is the light-mode image, darkSrc the dark one.
		darkSrc: string | null;
		// ZoomableImage: click to zoom.
		zoomable: boolean;
	};
}

export interface AsideNode {
	type: "aside";
	attrs: { variant: AsideVariant };
	content: BlockNode[];
}

export interface DiagramNode {
	type: "diagram";
	attrs: {
		// The <Diagram> wrapper's props; all null for a bare ```d2 fence.
		id: string | null;
		title: string | null;
		description: string | null;
		language: "d2";
		source: string;
		// Fence meta after the language, e.g. "sketch".
		meta: string | null;
		// Pre-rendered SVG URL; Workers cannot run d2, so seeds render it.
		src: string | null;
	};
}

export interface VideoNode {
	type: "video";
	attrs: {
		videoId: string;
		// null means the default https://content.rawkode.academy/videos/<id>/thumbnail.webp
		thumbnailUrl: string | null;
	};
}

export interface InteractiveNode {
	type: "interactive";
	attrs: {
		component: InteractiveComponent;
		props: { [key: string]: JsonValue };
		hydrate: HydrateDirective;
	};
}

export interface EmbedNode {
	type: "embed";
	attrs: {
		src: string;
		title: string | null;
		width: number | null;
		height: number | null;
		allow: string | null;
		allowFullscreen: boolean;
	};
}

export type BlockNode =
	| ParagraphNode
	| HeadingNode
	| BlockquoteNode
	| BulletListNode
	| OrderedListNode
	| TaskListNode
	| CodeBlockNode
	| HorizontalRuleNode
	| TableNode
	| ImageNode
	| AsideNode
	| DiagramNode
	| VideoNode
	| InteractiveNode
	| EmbedNode;

export interface DocNode {
	type: "doc";
	content: BlockNode[];
}

export type AnyNode =
	| DocNode
	| BlockNode
	| ListItemNode
	| TaskItemNode
	| TableRowNode
	| TableCellNode
	| InlineNode;

export type NodeType = AnyNode["type"];

export function videoThumbnailUrl(videoId: string): string {
	return `https://content.rawkode.academy/videos/${videoId}/thumbnail.webp`;
}

export function emptyDoc(): DocNode {
	return { type: "doc", content: [{ type: "paragraph" }] };
}

// True for a document with no visible content (TipTap's empty editor state).
export function isEmptyDoc(doc: DocNode): boolean {
	return doc.content.every(
		(block) =>
			block.type === "paragraph" &&
			(block.content ?? []).every(
				(node) => node.type === "text" && node.text.trim() === "",
			),
	);
}
