// Technology autolinking (was remark-tech-autolink): the first plain-text
// mention of each technology in a document becomes a link to
// /technology/<id>. Later mentions stay text. Headings, links, code, asides
// (MDX elements before) and other atoms are skipped, as before. The lookup is
// built from the technologies collection rather than content files.
import type {
	AnyNode,
	DocNode,
	InlineNode,
	Mark,
	TextNode,
} from "@rawkodeacademy/rich-text";

// Ambiguity guards carried over from remark-tech-autolink: short names and
// ordinary words that happen to be technology names.
export const DEFAULT_SKIP_NAMES = [
	"d",
	"k",
	"go",
	"ko",
	"score",
	"distribution",
	"salt",
	"namespace",
	"radius",
	"fleet",
	"waypoint",
];

export interface TechnologyLookup {
	/** lowercased name → technology id */
	names: Map<string, string>;
	pattern?: RegExp;
}

function escapeRegex(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTechnologyLookup(
	technologies: Iterable<{ id: string; name: string }>,
	options: { skipNames?: Iterable<string>; minLength?: number } = {},
): TechnologyLookup {
	const minLength = options.minLength ?? 3;
	const skip = new Set(
		[...DEFAULT_SKIP_NAMES, ...(options.skipNames ?? [])].map((n) =>
			n.toLowerCase(),
		),
	);
	const names = new Map<string, string>();
	const sorted = [...technologies].sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	);
	for (const { id, name } of sorted) {
		const key = name.trim().toLowerCase();
		if (!key || names.has(key)) continue;
		names.set(key, id.replace(/\/index$/, ""));
	}
	const eligible = [...names.keys()]
		.filter((name) => name.length >= minLength && !skip.has(name))
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex);
	return {
		names,
		...(eligible.length > 0
			? {
					pattern: new RegExp(
						`(?<![A-Za-z0-9-])(${eligible.join("|")})(?![A-Za-z0-9-])`,
						"gi",
					),
				}
			: {}),
	};
}

const SKIP_BLOCKS = new Set([
	"heading",
	"codeBlock",
	"aside",
	"diagram",
	"embed",
	"video",
	"interactive",
	"image",
]);

function linkMark(id: string): Mark {
	return {
		type: "link",
		attrs: {
			href: `/technology/${id}`,
			target: null,
			rel: null,
			class: null,
			title: null,
		},
	};
}

export interface AutolinkOptions {
	/** Technology ids never to link, e.g. the profile being rendered. */
	skipIds?: Iterable<string> | undefined;
}

export function autolinkTechnologies(
	doc: DocNode,
	lookup: TechnologyLookup,
	options: AutolinkOptions = {},
): DocNode {
	const found = lookup.pattern;
	if (!found) return doc;
	const pattern: RegExp = found;
	const linked = new Set<string>(
		[...(options.skipIds ?? [])].map((id) => id.replace(/\/index$/, "")),
	);

	function splitText(node: TextNode): TextNode[] | undefined {
		if (node.marks?.some((m) => m.type === "link" || m.type === "code")) {
			return undefined;
		}
		const value = node.text;
		pattern.lastIndex = 0;
		const out: TextNode[] = [];
		let cursor = 0;
		for (let match = pattern.exec(value); match; match = pattern.exec(value)) {
			const matched = match[1] ?? match[0];
			const id = lookup.names.get(matched.toLowerCase());
			if (!id || linked.has(id)) continue;
			linked.add(id);
			if (match.index > cursor) {
				out.push({ ...node, text: value.slice(cursor, match.index) });
			}
			out.push({
				type: "text",
				text: matched,
				marks: [linkMark(id), ...(node.marks ?? [])],
			});
			cursor = match.index + matched.length;
		}
		if (out.length === 0) return undefined;
		if (cursor < value.length) out.push({ ...node, text: value.slice(cursor) });
		return out;
	}

	function inline(content: InlineNode[]): InlineNode[] {
		const result: InlineNode[] = [];
		for (const node of content) {
			if (node.type === "text") {
				const split = splitText(node);
				if (split) {
					result.push(...split);
					continue;
				}
			}
			result.push(node);
		}
		return result;
	}

	function walk<N extends AnyNode>(node: N): N {
		if (SKIP_BLOCKS.has(node.type)) return node;
		if (node.type === "paragraph") {
			const content = (node as { content?: InlineNode[] }).content;
			return content ? ({ ...node, content: inline(content) } as N) : node;
		}
		if ("content" in node && Array.isArray(node.content)) {
			return {
				...node,
				content: (node.content as AnyNode[]).map((child) => walk(child)),
			} as N;
		}
		return node;
	}

	return walk(doc);
}
