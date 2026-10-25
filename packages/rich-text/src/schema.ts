// TipTap extensions for the document format, for editors and for validation.
// Importing this module pulls in @tiptap/core and ProseMirror; the website's
// render path only needs the root entry (toHtml/toText), which does not.
import {
	type AnyExtension,
	type Attribute,
	type Extensions,
	getSchema,
	Mark,
	mergeAttributes,
	Node,
} from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import {
	BulletList,
	ListItem,
	OrderedList,
	TaskItem,
	TaskList,
} from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import {
	Table,
	TableCell,
	TableHeader,
	TableRow,
} from "@tiptap/extension-table";
import Text from "@tiptap/extension-text";
import { Node as PMNode, type Schema } from "@tiptap/pm/model";
import {
	ASIDE_VARIANTS,
	type DocNode,
	HYDRATE_DIRECTIVES,
	INTERACTIVE_COMPONENTS,
} from "./types";

// Attribute checks for validateDoc. ProseMirror's check() only rejects unknown
// attributes; without these an aside variant or island name the website cannot
// render, or a number where a URL belongs, would be stored as valid.
type Check = (value: unknown) => boolean;

const string: Check = (value) => typeof value === "string";
const optionalString: Check = (value) => value === null || string(value);
const optionalNumber: Check = (value) =>
	value === null || (typeof value === "number" && Number.isFinite(value));
const boolean: Check = (value) => typeof value === "boolean";
const integer =
	(min: number, max = Number.MAX_SAFE_INTEGER): Check =>
	(value) =>
		Number.isInteger(value) &&
		(value as number) >= min &&
		(value as number) <= max;
const oneOf =
	(values: readonly unknown[], nullable = false): Check =>
	(value) =>
		(nullable && value === null) || values.includes(value);
const plainObject: Check = (value) =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const widths: Check = (value) =>
	value === null ||
	(Array.isArray(value) && value.every((width) => Number.isFinite(width)));

// Every attribute the extension declares must have a check, so a new attribute
// cannot slip past validateDoc unchecked.
function validated<E extends AnyExtension>(
	extension: E,
	checks: Record<string, Check>,
): E {
	// biome-ignore lint/suspicious/noExplicitAny: Node and Mark both have extend()
	return (extension as any).extend({
		addAttributes(this: { parent?: () => Record<string, Attribute> }) {
			const attributes = this.parent?.() ?? {};
			for (const name of Object.keys(attributes)) {
				if (!checks[name]) {
					throw new Error(`${extension.name}.${name} has no validation`);
				}
			}
			return Object.fromEntries(
				Object.entries(attributes).map(([name, attribute]) => [
					name,
					{
						...attribute,
						validate: (value: unknown) => {
							if (!checks[name]?.(value)) {
								throw new RangeError(
									`Invalid ${extension.name}.${name}: ${JSON.stringify(value)}`,
								);
							}
						},
					},
				]),
			);
		},
	}) as E;
}

// The DOM element type TipTap hands to parseHTML, without pulling in lib.dom.
type ParsedElement = Parameters<NonNullable<Attribute["parseHTML"]>>[0];

const HeadingWithId = Heading.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			id: {
				default: null,
				parseHTML: (element) => element.getAttribute("id"),
				renderHTML: (attributes) =>
					attributes.id ? { id: attributes.id } : {},
			},
		};
	},
});

const CodeBlockWithMeta = CodeBlock.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			title: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-title"),
				renderHTML: (attributes) =>
					attributes.title ? { "data-title": attributes.title } : {},
			},
			meta: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-meta"),
				renderHTML: (attributes) =>
					attributes.meta ? { "data-meta": attributes.meta } : {},
			},
		};
	},
});

// TipTap's code mark excludes every other mark; Markdown allows `code` inside
// links and emphasis, which the content uses, so it only excludes itself.
const CodeInLinks = Code.extend({ excludes: "code" });

const alignAttribute = {
	align: {
		default: null,
		parseHTML: (element: ParsedElement) =>
			element.getAttribute("align") ?? (element.style.textAlign || null),
		renderHTML: (attributes: Record<string, unknown>) =>
			attributes.align ? { align: attributes.align } : {},
	},
};

const AlignedTableCell = TableCell.extend({
	addAttributes() {
		return { ...this.parent?.(), ...alignAttribute };
	},
});

const AlignedTableHeader = TableHeader.extend({
	addAttributes() {
		return { ...this.parent?.(), ...alignAttribute };
	},
});

const ThemedImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			darkSrc: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-dark-src"),
				renderHTML: (attributes) =>
					attributes.darkSrc ? { "data-dark-src": attributes.darkSrc } : {},
			},
			zoomable: {
				default: false,
				parseHTML: (element) => element.hasAttribute("data-zoomable"),
				renderHTML: (attributes) =>
					attributes.zoomable ? { "data-zoomable": "" } : {},
			},
		};
	},
});

export const Kbd = Mark.create({
	name: "kbd",
	parseHTML: () => [{ tag: "kbd" }],
	renderHTML: ({ HTMLAttributes }) => ["kbd", HTMLAttributes, 0],
});

export const Superscript = Mark.create({
	name: "superscript",
	excludes: "superscript",
	parseHTML: () => [{ tag: "sup" }],
	renderHTML: ({ HTMLAttributes }) => ["sup", HTMLAttributes, 0],
});

export const Aside = Node.create({
	name: "aside",
	group: "block",
	content: "block+",
	defining: true,
	addAttributes() {
		return {
			variant: {
				default: "info",
				parseHTML: (element) => {
					const value = element.getAttribute("data-variant");
					return ASIDE_VARIANTS.includes(value as never) ? value : "info";
				},
				renderHTML: (attributes) => ({ "data-variant": attributes.variant }),
			},
		};
	},
	parseHTML: () => [{ tag: "aside[data-variant]" }],
	renderHTML: ({ HTMLAttributes }) => ["aside", HTMLAttributes, 0],
});

// Atom nodes keep their attributes as data-* so an editor can copy/paste them.
function dataAttributes(names: string[], json: string[] = []) {
	const attributes: Record<string, unknown> = {};
	for (const name of names) {
		const key = `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
		const isJson = json.includes(name);
		attributes[name] = {
			parseHTML: (element: ParsedElement) => {
				const value = element.getAttribute(key);
				if (value === null) return null;
				return isJson ? JSON.parse(value) : value;
			},
			renderHTML: (values: Record<string, unknown>) =>
				values[name] === null || values[name] === undefined
					? {}
					: {
							[key]: isJson
								? JSON.stringify(values[name])
								: String(values[name]),
						},
		};
	}
	return attributes;
}

function atom(
	name: string,
	attrs: Record<string, unknown>,
	json: string[] = [],
) {
	const parsers = dataAttributes(Object.keys(attrs), json);
	return Node.create({
		name,
		group: "block",
		atom: true,
		draggable: true,
		addAttributes() {
			return Object.fromEntries(
				Object.entries(attrs).map(([key, fallback]) => [
					key,
					{ default: fallback, ...(parsers[key] as object) },
				]),
			);
		},
		parseHTML: () => [{ tag: `div[data-node="${name}"]` }],
		renderHTML: ({ HTMLAttributes }) => [
			"div",
			mergeAttributes({ "data-node": name }, HTMLAttributes),
		],
	});
}

export const Diagram = atom("diagram", {
	id: null,
	title: null,
	description: null,
	language: "d2",
	source: "",
	meta: null,
	src: null,
});

export const Video = atom("video", { videoId: "", thumbnailUrl: null });

export const Interactive = atom(
	"interactive",
	{
		component: INTERACTIVE_COMPONENTS[0],
		props: {},
		hydrate: HYDRATE_DIRECTIVES[2],
	},
	["props"],
);

export const Embed = atom("embed", {
	src: "",
	title: null,
	width: null,
	height: null,
	allow: null,
	allowFullscreen: false,
});

const cellChecks = {
	colspan: integer(1),
	rowspan: integer(1),
	colwidth: widths,
	align: oneOf(["left", "center", "right"], true),
};

// Order matters: the first block node (paragraph) is ProseMirror's default
// fill, and mark order here is MARK_ORDER (Link has TipTap priority 1000).
export const extensions: Extensions = [
	Document,
	Text,
	Paragraph,
	validated(HeadingWithId, {
		level: integer(1, 6),
		id: optionalString,
	}).configure({ levels: [1, 2, 3, 4, 5, 6] }),
	Blockquote,
	BulletList,
	validated(OrderedList, { start: integer(0), type: optionalString }),
	ListItem,
	TaskList,
	validated(TaskItem, { checked: boolean }).configure({ nested: true }),
	validated(CodeBlockWithMeta, {
		language: optionalString,
		title: optionalString,
		meta: optionalString,
	}).configure({ defaultLanguage: null }),
	HorizontalRule,
	HardBreak,
	Table,
	TableRow,
	validated(AlignedTableHeader, cellChecks),
	validated(AlignedTableCell, cellChecks),
	validated(ThemedImage, {
		src: string,
		alt: optionalString,
		title: optionalString,
		width: optionalNumber,
		height: optionalNumber,
		darkSrc: optionalString,
		zoomable: boolean,
	}).configure({ inline: false }),
	validated(Aside, { variant: oneOf(ASIDE_VARIANTS) }),
	validated(Diagram, {
		id: optionalString,
		title: optionalString,
		description: optionalString,
		language: oneOf(["d2"]),
		source: string,
		meta: optionalString,
		src: optionalString,
	}),
	validated(Video, { videoId: string, thumbnailUrl: optionalString }),
	validated(Interactive, {
		component: oneOf(INTERACTIVE_COMPONENTS),
		props: plainObject,
		hydrate: oneOf(HYDRATE_DIRECTIVES),
	}),
	validated(Embed, {
		src: string,
		title: optionalString,
		width: optionalNumber,
		height: optionalNumber,
		allow: optionalString,
		allowFullscreen: boolean,
	}),
	validated(Link, {
		href: string,
		target: optionalString,
		rel: optionalString,
		class: optionalString,
		title: optionalString,
	}).configure({
		openOnClick: false,
		autolink: false,
		HTMLAttributes: { target: null, rel: null, class: null },
	}),
	Bold,
	Italic,
	Strike,
	Kbd,
	Superscript,
	CodeInLinks,
];

let cached: Schema | undefined;

export function schema(): Schema {
	cached ??= getSchema(extensions);
	return cached;
}

// Parses and checks a stored document. Throws a RangeError naming the problem
// when the JSON does not fit the schema.
export function validateDoc(doc: DocNode | unknown): PMNode {
	const node = PMNode.fromJSON(schema(), doc);
	node.check();
	return node;
}
