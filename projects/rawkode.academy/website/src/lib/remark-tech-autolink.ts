/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic; repeating
 * the same anchor lowers signal and looks spammy).
 *
 * Per-file opt-out: include the literal HTML comment
 * `<!-- no-autolink -->` anywhere in the body.
 */
import type { Plugin } from "unified";
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

// Single- and two-letter ambiguity guards. Real two-or-more-letter
// tech names (bun, ko, next, lit, ...) that overlap with English words
// should be opted out per-call via skipNames, not hardcoded here.
const DEFAULT_SKIP = ["d", "k", "go", "ko"];

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

/**
 * Returns a unified `Plugin`: when invoked by `.use()`, unified calls
 * the outer function to retrieve the per-file transformer. Passing a
 * bare `(tree, file) => void` would be treated as the Plugin itself
 * and produce no transformer (silent no-op).
 */
export function remarkTechAutolink(
	options: AutolinkOptions,
): Plugin<[], Root> {
	const minLength = options.minLength ?? 3;
	const skip = new Set<string>(DEFAULT_SKIP);
	for (const name of options.skipNames ?? []) {
		skip.add(name.toLowerCase());
	}

	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);
	const skipPathSubstrings =
		options.skipPathSubstrings ?? DEFAULT_SKIP_PATH_SUBSTRINGS;

	return function attach() {
		return function transform(tree: Root, file: VFile): void {
			if (!pattern) return;

			const path = file.path ?? "";
			for (const fragment of skipPathSubstrings) {
				if (path.includes(fragment)) return;
			}

			const source = typeof file.value === "string" ? file.value : "";
			if (source && SKIP_COMMENT_PATTERN.test(source)) return;

			const linked = new Set<string>();

			function buildReplacement(text: TextNode): Node[] | undefined {
				const value = text.value;
				if (!value) return undefined;

				pattern.lastIndex = 0;
				const newNodes: Node[] = [];
				let cursor = 0;
				let match = pattern.exec(value);
				while (match) {
					const matched = match[1] ?? match[0];
					const start = match.index;
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
						});
						cursor = start + matched.length;
					}
					match = pattern.exec(value);
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
		};
	};
}
