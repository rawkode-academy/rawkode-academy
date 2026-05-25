/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic; repeating
 * the same anchor lowers signal and looks spammy).
 *
 * Per-file opt-out: include `<!-- no-autolink -->` in Markdown or an
 * MDX JSX comment containing `no-autolink`.
 */
import type { VFile } from "vfile";

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
	/**
	 * Path-substring deny list. Any file whose vfile path contains one
	 * of these substrings is skipped. Default: skip technology profile
	 * pages so they don't self-link.
	 */
	skipPathSubstrings?: ReadonlyArray<string>;
}

const DEFAULT_SKIP_PATH_SUBSTRINGS = ["/content/technologies/"];

// Ambiguity guards: single/two-letter names and common English words
// that happen to be tracked tech names. These false-positive too often
// to be auto-linked sitewide. Per-call exclusions go in skipNames.
const DEFAULT_SKIP = [
	"d",
	"k",
	"go",
	"ko",
	"score",
	"distribution",
	"salt",
];

const SKIP_COMMENT_PATTERN =
	/<!--\s*no-autolink\s*-->|\{\/\*\s*no-autolink\s*\*\/\}/i;

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

function escapeRegex(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function buildSkipSet(skipNames: ReadonlyArray<string> = []): Set<string> {
	return new Set([
		...DEFAULT_SKIP,
		...skipNames.map((name) => name.toLowerCase()),
	]);
}

function shouldSkipFile(
	file: VFile,
	skipPathSubstrings: ReadonlyArray<string>,
): boolean {
	const path = file.path ?? "";
	if (skipPathSubstrings.some((fragment) => path.includes(fragment))) {
		return true;
	}

	const source = typeof file.value === "string" ? file.value : "";
	return source !== "" && SKIP_COMMENT_PATTERN.test(source);
}

interface LinkState {
	pattern: RegExp;
	lookup: Map<string, string>;
	linked: Set<string>;
}

function isNode(value: Node | undefined): value is Node {
	return Boolean(
		value && typeof value === "object" && typeof value.type === "string",
	);
}

function isParent(node: Node): node is Parent {
	return Array.isArray((node as Partial<Parent>).children);
}

function appendLinkReplacement(
	nodes: Node[],
	value: string,
	cursor: number,
	start: number,
	matched: string,
	techId: string,
): number {
	if (start > cursor) {
		nodes.push({
			type: "text",
			value: value.slice(cursor, start),
		});
	}

	nodes.push({
		type: "link",
		url: `/technology/${techId}`,
		children: [{ type: "text", value: matched }],
	});

	return start + matched.length;
}

function buildReplacement(
	text: TextNode,
	state: LinkState,
): Node[] | undefined {
	const value = text.value;
	if (!value) return undefined;

	state.pattern.lastIndex = 0;
	const nodes: Node[] = [];
	let cursor = 0;
	let match = state.pattern.exec(value);
	while (match) {
		const matched = match[1] ?? match[0];
		const techId = state.lookup.get(matched.toLowerCase());
		if (techId && !state.linked.has(techId)) {
			state.linked.add(techId);
			cursor = appendLinkReplacement(
				nodes,
				value,
				cursor,
				match.index,
				matched,
				techId,
			);
		}
		match = state.pattern.exec(value);
	}

	if (nodes.length === 0) return undefined;
	if (cursor < value.length) {
		nodes.push({ type: "text", value: value.slice(cursor) });
	}
	return nodes;
}

function replaceTextChild(
	parent: Parent,
	index: number,
	text: TextNode,
	state: LinkState,
): number {
	const replacement = buildReplacement(text, state);
	if (!replacement) return index;

	parent.children.splice(index, 1, ...replacement);
	return index + replacement.length - 1;
}

function walk(node: Node | undefined, state: LinkState): void {
	if (!isNode(node) || IGNORE_TYPES.has(node.type) || !isParent(node)) return;

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (!isNode(child)) continue;
		if (child.type === "text") {
			i = replaceTextChild(node, i, child as TextNode, state);
			continue;
		}
		walk(child, state);
	}
}

/**
 * Returns a unified `Plugin`: when invoked by `.use()`, unified calls
 * the outer function to retrieve the per-file transformer. Passing a
 * bare `(tree, file) => void` would be treated as the Plugin itself
 * and produce no transformer (silent no-op).
 */
export function remarkTechAutolink(
	options: AutolinkOptions,
): () => (tree: Root, file: VFile) => void {
	const minLength = options.minLength ?? 3;
	const skip = buildSkipSet(options.skipNames);
	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);
	const skipPathSubstrings =
		options.skipPathSubstrings ?? DEFAULT_SKIP_PATH_SUBSTRINGS;

	return function attach() {
		return function transform(tree: Root, file: VFile): void {
			if (!pattern || shouldSkipFile(file, skipPathSubstrings)) return;
			walk(tree, {
				pattern,
				lookup: options.lookup,
				linked: new Set<string>(),
			});
		};
	};
}
