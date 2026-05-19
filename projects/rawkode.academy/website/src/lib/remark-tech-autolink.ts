/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic; repeating
 * the same anchor lowers signal and looks spammy).
 *
 * Built on `unist-util-visit` (the canonical mdast tree walker). We
 * visit every text node, check that none of its ancestors are in the
 * ignore set (headings, links, code, MDX JSX, etc.), and splice the
 * text node into a sequence of `[text, link, text, link, ...]` in its
 * parent's children array.
 *
 * Per-file opt-out: include the literal HTML comment
 * `<!-- no-autolink -->` anywhere in the body.
 */
import { visitParents, SKIP } from "unist-util-visit-parents";

interface Node {
	type: string;
	[key: string]: unknown;
}
interface Parent extends Node {
	children: Node[];
}
interface TextNode extends Node {
	type: "text";
	value: string;
}
interface Root extends Parent {
	type: "root";
}

export interface AutolinkOptions {
	/** Map of lowercased canonical name -> technology id used in URLs. */
	lookup: Map<string, string>;
	/** Names to never link (case-insensitive). */
	skipNames?: ReadonlyArray<string>;
	/** Minimum length of a tech name to be eligible. */
	minLength?: number;
}

const DEFAULT_SKIP = [
	"go",
	"ko",
	"d",
	"k",
	"bun",
	"act",
	"lit",
	"next",
];

const SKIP_COMMENT_PATTERN = /<!--\s*no-autolink\s*-->/i;

// Node types whose text descendants must never be auto-linked. The
// first group is the standard markdown ignore set (matching what
// `mdast-util-find-and-replace` uses by default); the second is the
// MDX-specific subtree we never want to touch.
const IGNORE_TYPES = new Set<string>([
	"heading",
	"link",
	"linkReference",
	"definition",
	"code",
	"inlineCode",
	"html",
	"yaml",
	"toml",
	"mdxJsxFlowElement",
	"mdxJsxTextElement",
	"mdxFlowExpression",
	"mdxTextExpression",
	"mdxjsEsm",
]);

function buildPattern(
	names: ReadonlyArray<string>,
	skip: Set<string>,
	minLength: number,
): RegExp | undefined {
	const eligible = names
		.filter((name) => name.length >= minLength && !skip.has(name.toLowerCase()))
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex);
	if (eligible.length === 0) return undefined;
	return new RegExp(
		`(?<![A-Za-z0-9-])(${eligible.join("|")})(?![A-Za-z0-9-])`,
		"gi",
	);
}

function escapeRegex(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface FileWithValue {
	value?: string;
	contents?: string;
}

function readFileSource(file: unknown): string {
	const candidate = file as FileWithValue | undefined;
	if (!candidate) return "";
	if (typeof candidate.value === "string") return candidate.value;
	if (typeof candidate.contents === "string") return candidate.contents;
	return "";
}

export function remarkTechAutolink(
	options: AutolinkOptions,
): (tree: Root, file: unknown) => void {
	const minLength = options.minLength ?? 3;
	const skip = new Set<string>(DEFAULT_SKIP);
	for (const name of options.skipNames ?? []) {
		skip.add(name.toLowerCase());
	}

	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);

	return function transform(tree: Root, file: unknown): void {
		if (!pattern) return;

		const source = readFileSource(file);
		if (source && SKIP_COMMENT_PATTERN.test(source)) return;

		const linked = new Set<string>();

		// Collect (parent, index, replacement) tuples first, then apply
		// them in reverse so each splice doesn't shift the indices of
		// pending splices. Mutating during visit corrupts the traversal.
		interface Replacement {
			parent: Parent;
			index: number;
			nodes: Node[];
		}
		const replacements: Replacement[] = [];

		// biome-ignore lint/suspicious/noExplicitAny: avoid pulling in mdast types
		visitParents(tree as any, "text", (node: any, ancestors: any[]) => {
			// If any ancestor is in the ignore set, skip this text node
			// AND skip descent into siblings (we're at a leaf anyway, so
			// the SKIP only matters when ignore-set entries are deeper).
			for (const ancestor of ancestors) {
				if (ancestor && IGNORE_TYPES.has(ancestor.type)) {
					return SKIP;
				}
			}

			const text = node as TextNode;
			const value = text.value;
			if (!value) return;

			pattern.lastIndex = 0;
			let match = pattern.exec(value);
			if (!match) return;

			const parent = ancestors[ancestors.length - 1] as Parent | undefined;
			if (!parent || !Array.isArray(parent.children)) return;
			const index = parent.children.indexOf(text);
			if (index === -1) return;

			const newNodes: Node[] = [];
			let cursor = 0;
			while (match) {
				const matched = match[1] ?? match[0];
				const start = match.index;
				const end = start + matched.length;
				const techId = options.lookup.get(matched.toLowerCase());
				if (techId && !linked.has(techId)) {
					linked.add(techId);
					if (start > cursor) {
						newNodes.push({
							type: "text",
							value: value.slice(cursor, start),
						});
					}
					newNodes.push({
						type: "link",
						url: `/technology/${techId}`,
						children: [{ type: "text", value: matched }],
					} as Node);
					cursor = end;
				}
				match = pattern.exec(value);
			}

			if (newNodes.length === 0) return;
			if (cursor < value.length) {
				newNodes.push({ type: "text", value: value.slice(cursor) });
			}

			replacements.push({ parent, index, nodes: newNodes });
		});

		// Apply in reverse so earlier splices don't shift later indices.
		// Group by parent so multiple replacements within the same parent
		// stay consistent (sort by descending index within each parent;
		// since replacements were collected in document order, a simple
		// reverse iteration is sufficient).
		for (let i = replacements.length - 1; i >= 0; i--) {
			const { parent, index, nodes } = replacements[i];
			parent.children.splice(index, 1, ...nodes);
		}
	};
}
