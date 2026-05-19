/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic — repeating
 * the same anchor lowers signal and looks spammy).
 *
 * Skips:
 *   - text inside code blocks / inline code (`visit` doesn't traverse code
 *     children, so these are naturally exempt)
 *   - text inside existing links (so we don't double-link)
 *   - text inside headings (autolinks in headings would alter the
 *     document outline; headings already get keyword weight)
 *   - text inside MDX/JSX components and raw HTML
 *
 * Opt out per file by including the literal HTML comment
 * `<!-- no-autolink -->` anywhere in the body.
 *
 * False-positive guard: a curated skip list and a minimum-length floor
 * keep ambiguous names like `Go` or `D` from getting linked. Names are
 * matched case-insensitively with custom alnum boundaries so hyphenated
 * names like `kube-vip` and `cert-manager` work correctly.
 */
import { SKIP, visit } from "unist-util-visit";

// `@types/mdast` and `@types/unist` aren't installed, and we don't want to
// pull them in just to type a single transformer. The shapes below are the
// minimum the plugin actually touches.
interface Node {
	type: string;
	[key: string]: unknown;
}
interface Parent extends Node {
	children: Node[];
}
interface Text extends Node {
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
	"go", // language vs verb
	"ko", // image builder vs Korean letter
	"d", // single letter
	"k", // single letter
	"bun", // runtime vs food
	"act", // github actions runner vs verb
	"lit", // framework vs adjective
	"next", // framework vs word
];

const SKIP_COMMENT_PATTERN = /<!--\s*no-autolink\s*-->/i;

type LinkableTextParent = Parent & { type: string };

const SKIP_PARENT_TYPES = new Set([
	"heading",
	"link",
	"linkReference",
	"code",
	"inlineCode",
	"html",
	"yaml",
	"toml",
	// MDX nodes — anything authored as JSX should not be auto-rewritten.
	"mdxJsxFlowElement",
	"mdxJsxTextElement",
	"mdxFlowExpression",
	"mdxTextExpression",
	"mdxjsEsm",
]);

function shouldSkipParent(parent: LinkableTextParent | undefined): boolean {
	if (!parent) return true;
	return SKIP_PARENT_TYPES.has(parent.type);
}

function buildPattern(
	names: ReadonlyArray<string>,
	skip: Set<string>,
	minLength: number,
): RegExp | undefined {
	// Sort by descending length so longer names match first (e.g. "cert-manager"
	// matches before "cert" would).
	const eligible = names
		.filter((name) => name.length >= minLength && !skip.has(name.toLowerCase()))
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex);
	if (eligible.length === 0) return undefined;
	// Custom identifier boundaries: alphanumeric AND hyphens. Including the
	// hyphen prevents false positives like "apko-style" or "x-apko-y" while
	// still matching `kube-vip` in normal prose (where the adjacent chars
	// are whitespace, not hyphens). Hyphens within a tech name itself are
	// inside the captured group, not at the boundary, so they're unaffected.
	return new RegExp(
		`(?<![A-Za-z0-9-])(${eligible.join("|")})(?![A-Za-z0-9-])`,
		"i",
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

/**
 * Plugin factory: returns a unified transformer suitable for
 * `.use(remarkTechAutolink({ lookup }))`. The return shape is a plain
 * `(tree, file) => void` function which is what `unified` expects for
 * a transformer; we type the inner function with our minimal Root/Node
 * shapes rather than the full `unified` Plugin type to avoid pulling in
 * `@types/unist` / `@types/mdast`.
 */
export function remarkTechAutolink(
	options: AutolinkOptions,
): (tree: Root, file: unknown) => void {
	const minLength = options.minLength ?? 3;
	const skip = new Set<string>(DEFAULT_SKIP);
	for (const name of options.skipNames ?? []) {
		skip.add(name.toLowerCase());
	}

	// Build a single regex from all eligible canonical names. The lookup is
	// keyed by lowercased name so we can resolve a match back to its id.
	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);

	return function transform(tree: Root, file: unknown): void {
		if (!pattern) return;

		// Per-file opt-out by HTML comment in the original source.
		const source = readFileSource(file);
		if (source && SKIP_COMMENT_PATTERN.test(source)) return;

		// Re-create the global regex per document so the per-text `lastIndex`
		// state doesn't leak across documents.
		const globalPattern = new RegExp(pattern.source, "gi");
		const linked = new Set<string>();

		// We pass our minimal `Root` shape through unist-util-visit's
		// generic. unist-util-visit's own types come from `@types/unist`,
		// which isn't installed; the casts here keep the call type-safe
		// against our local Node interface without pulling that in.
		visit(
			tree as unknown as Parameters<typeof visit>[0],
			"text",
			(rawNode, index, rawParent) => {
				const node = rawNode as unknown as Text;
				const parent = rawParent as LinkableTextParent | undefined;
				if (index === undefined || index === null) return;
				if (shouldSkipParent(parent)) return SKIP;

				const original = node.value;
				if (!original) return;

				globalPattern.lastIndex = 0;
				const segments: Array<
					Text | { type: "link"; url: string; children: Text[] }
				> = [];
				let cursor = 0;
				let didReplace = false;
				let match: RegExpExecArray | null;

				while ((match = globalPattern.exec(original)) !== null) {
					const matched = match[1];
					if (matched === undefined) break;
					const techId = options.lookup.get(matched.toLowerCase());
					if (!techId || linked.has(techId)) {
						// Either not a tracked tech name or already linked
						// once in this document — leave it as plain text
						// but advance past it.
						continue;
					}

					if (match.index > cursor) {
						segments.push({
							type: "text",
							value: original.slice(cursor, match.index),
						});
					}
					segments.push({
						type: "link",
						url: `/technology/${techId}`,
						children: [{ type: "text", value: matched }],
					});
					linked.add(techId);
					cursor = match.index + matched.length;
					didReplace = true;
				}

				if (!didReplace) return;
				if (cursor < original.length) {
					segments.push({
						type: "text",
						value: original.slice(cursor),
					});
				}

				const replacement = segments as Text[];
				if (!parent) return;
				parent.children.splice(index, 1, ...(replacement as Node[]));
				return [SKIP, index + replacement.length];
			},
		);
	};
}
