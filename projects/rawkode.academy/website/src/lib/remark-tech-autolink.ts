/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic; repeating
 * the same anchor lowers signal and looks spammy).
 *
 * We previously tried `mdast-util-find-and-replace` and a direct
 * `unist-util-visit-parents` walk; both crashed with
 * `Cannot use 'in' operator to search for 'children' in undefined`
 * on certain Astro-rendered trees, because visit-parents@6 throws when
 * an intermediate node's `children` array contains a sparse/undefined
 * entry (which can come from the markdown pipeline upstream). Plain
 * recursion sidesteps that entirely and is the simplest correct walk
 * for what we need: pre-order descent, splice-into-parent on text
 * matches, and skip the ignore-set subtrees.
 *
 * Per-file opt-out: include the literal HTML comment
 * `<!-- no-autolink -->` anywhere in the body.
 */

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

const DEFAULT_SKIP_PATH_SUBSTRINGS = [
	"/content/technologies/",
];

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
	path?: string;
	history?: string[];
}

function readFileSource(file: unknown): string {
	const candidate = file as FileWithValue | undefined;
	if (!candidate) return "";
	if (typeof candidate.value === "string") return candidate.value;
	if (typeof candidate.contents === "string") return candidate.contents;
	return "";
}

function readFilePath(file: unknown): string {
	const candidate = file as FileWithValue | undefined;
	if (!candidate) return "";
	if (typeof candidate.path === "string") return candidate.path;
	if (Array.isArray(candidate.history) && typeof candidate.history[0] === "string") {
		return candidate.history[0];
	}
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
	const skipPathSubstrings =
		options.skipPathSubstrings ?? DEFAULT_SKIP_PATH_SUBSTRINGS;

	console.error(
		`[remark-tech-autolink] init: lookup=${options.lookup.size} pattern=${pattern ? "ok" : "EMPTY"} skip=${Array.from(skip).join(",")}`,
	);

	return function transform(tree: Root, file: unknown): void {
		if (!pattern) {
			console.error("[remark-tech-autolink] no pattern; returning");
			return;
		}
		const re = pattern;

		const path = readFilePath(file);
		if (path) {
			for (const fragment of skipPathSubstrings) {
				if (path.includes(fragment)) {
					console.error(`[remark-tech-autolink] skip path=${path}`);
					return;
				}
			}
		}
		console.error(`[remark-tech-autolink] enter path=${path || "(no path)"}`);

		const source = readFileSource(file);
		if (source && SKIP_COMMENT_PATTERN.test(source)) return;

		const linked = new Set<string>();
		let textNodesSeen = 0;
		let matchesFound = 0;
		let linksProduced = 0;

		function buildReplacement(text: TextNode): Node[] | undefined {
			const value = text.value;
			if (!value) return undefined;
			textNodesSeen++;

			re.lastIndex = 0;
			const newNodes: Node[] = [];
			let cursor = 0;
			let match = re.exec(value);
			while (match) {
				matchesFound++;
				const matched = match[1] ?? match[0];
				const start = match.index;
				const techId = options.lookup.get(matched.toLowerCase());
				if (techId && !linked.has(techId)) {
					linked.add(techId);
					linksProduced++;
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
					});
					cursor = start + matched.length;
				}
				match = re.exec(value);
			}

			if (newNodes.length === 0) return undefined;
			if (cursor < value.length) {
				newNodes.push({ type: "text", value: value.slice(cursor) });
			}
			return newNodes;
		}

		function walk(node: Node | undefined): void {
			if (!node || typeof node !== "object") return;
			if (typeof node.type !== "string") return;
			if (IGNORE_TYPES.has(node.type)) return;
			const children = (node as Partial<Parent>).children;
			if (!Array.isArray(children)) return;

			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (!child || typeof child !== "object") continue;
				if (child.type === "text") {
					const replacement = buildReplacement(child as TextNode);
					if (replacement) {
						children.splice(i, 1, ...replacement);
						i += replacement.length - 1;
					}
				} else {
					walk(child);
				}
			}
		}

		walk(tree);
		console.error(
			`[remark-tech-autolink] done path=${path || "(no path)"} textNodes=${textNodesSeen} matches=${matchesFound} links=${linksProduced}`,
		);
	};
}
