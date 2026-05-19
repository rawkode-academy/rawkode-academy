/**
 * remark plugin: on the FIRST plain-text mention of any technology in the
 * `technologies` content collection, rewrite the text into a link to
 * `/technology/{id}`. Subsequent mentions stay as text (one link per
 * article per technology is the established SEO heuristic — repeating
 * the same anchor lowers signal and looks spammy).
 *
 * Built on `mdast-util-find-and-replace`, which is the canonical mdast
 * tool for this kind of text-to-node rewrite. It handles the skip set
 * (code, inline code, links, headings, html, definition, ...) and the
 * splicing-into-parent-children mechanics for us, which avoids the
 * tree-corruption failure modes the hand-rolled walker hit before.
 *
 * Per-file opt-out: include the literal HTML comment
 * `<!-- no-autolink -->` anywhere in the body.
 *
 * False-positive guard: a curated skip list and a minimum-length floor
 * keep ambiguous names like `Go` or `D` from getting linked. Names are
 * matched case-insensitively with custom alnum-and-hyphen boundaries so
 * `kube-vip` and `cert-manager` work and `apko-style` does not.
 */
import { findAndReplace } from "mdast-util-find-and-replace";

// `@types/mdast` and `@types/unist` aren't installed, and we don't want
// to pull them in just to type a single transformer. The shapes below
// are the minimum the plugin actually touches.
interface Node {
	type: string;
	[key: string]: unknown;
}
interface Parent extends Node {
	children: Node[];
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

function buildPattern(
	names: ReadonlyArray<string>,
	skip: Set<string>,
	minLength: number,
): RegExp | undefined {
	// Sort by descending length so longer names match first (e.g.
	// "cert-manager" matches before "cert" would).
	const eligible = names
		.filter((name) => name.length >= minLength && !skip.has(name.toLowerCase()))
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex);
	if (eligible.length === 0) return undefined;
	// Custom identifier boundaries: alphanumeric AND hyphens. Including
	// the hyphen prevents false positives like "apko-style" or "x-apko-y"
	// while still matching `kube-vip` in normal prose (where the adjacent
	// chars are whitespace, not hyphens). Hyphens within a tech name
	// itself are inside the captured group, not at the boundary, so
	// they're unaffected.
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

/**
 * Plugin factory: returns a unified transformer suitable for
 * `.use(remarkTechAutolink({ lookup }))`. The return shape is a plain
 * `(tree, file) => void` function which is what `unified` expects for
 * a transformer; we type the inner function with our minimal Root/Node
 * shapes rather than the full `unified` Plugin type to avoid pulling
 * in `@types/unist` / `@types/mdast`.
 */
export function remarkTechAutolink(
	options: AutolinkOptions,
): (tree: Root, file: unknown) => void {
	const minLength = options.minLength ?? 3;
	const skip = new Set<string>(DEFAULT_SKIP);
	for (const name of options.skipNames ?? []) {
		skip.add(name.toLowerCase());
	}

	// Build a single regex from all eligible canonical names. The lookup
	// is keyed by lowercased name so we can resolve a match back to its
	// id.
	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);

	return function transform(tree: Root, file: unknown): void {
		if (!pattern) return;

		// Per-file opt-out by HTML comment in the original source.
		const source = readFileSource(file);
		if (source && SKIP_COMMENT_PATTERN.test(source)) return;

		const linked = new Set<string>();

		// `findAndReplace` does the heavy lifting:
		//   - walks the tree
		//   - skips text inside code, inline code, links, headings, raw
		//     html, link-references, definitions (its default ignore set
		//     is `["heading", "link", "linkReference", "definition", "code",
		//     "inlineCode", "html"]` which matches our needs)
		//   - handles the splice-the-parent-children mechanics safely
		// Cast through `unknown` at the boundary: this plugin doesn't
		// install `@types/mdast`, but `findAndReplace`'s runtime accepts
		// our plain object literal — it just expects `Link` and `Text`
		// shapes which we satisfy structurally.
		const replace = (matched: string): unknown => {
			const techId = options.lookup.get(matched.toLowerCase());
			if (!techId || linked.has(techId)) {
				// Already linked once in this document, or not a tracked
				// tech name. Returning `false` tells `findAndReplace` to
				// leave the text untouched.
				return false;
			}
			linked.add(techId);
			return {
				type: "link",
				url: `/technology/${techId}`,
				children: [{ type: "text", value: matched }],
			};
		};
		// Skip text inside MDX-specific subtrees on top of
		// findAndReplace's default ignore set (which already covers
		// code, inlineCode, link, linkReference, definition, heading).
		// Returning a value (or `false`) from the replace function for
		// a text node inside JSX is what corrupted the tree before;
		// stopping the descent at the JSX boundary avoids it entirely.
		// biome-ignore lint/suspicious/noExplicitAny: mdast types not in scope
		const ignore: any = (node: { type?: string }) =>
			typeof node?.type === "string" &&
			(node.type === "mdxJsxFlowElement" ||
				node.type === "mdxJsxTextElement" ||
				node.type === "mdxFlowExpression" ||
				node.type === "mdxTextExpression" ||
				node.type === "mdxjsEsm" ||
				node.type === "html" ||
				node.type === "yaml" ||
				node.type === "toml");
		// biome-ignore lint/suspicious/noExplicitAny: mdast types not in scope
		const args: any = [tree, [[pattern, replace]], { ignore }];
		try {
			findAndReplace(args[0], args[1], args[2]);
		} catch (err) {
			// Belt-and-braces: if find-and-replace hits a malformed
			// subtree (e.g., a tree shape we haven't anticipated) we
			// leave the document untouched rather than break the build.
			// Worst case the article doesn't get autolinks; best case
			// nothing of value is lost. Surface the failure so it's
			// fixable later.
			console.warn(
				"[remark-tech-autolink] skipped document due to error:",
				err instanceof Error ? err.message : err,
			);
		}
	};
}
