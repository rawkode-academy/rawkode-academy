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
import type { Root, Text } from "mdast";
import type { Plugin } from "unified";
import type { Parent } from "unist";
import { visit, SKIP } from "unist-util-visit";

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

export function remarkTechAutolink(
	options: AutolinkOptions,
): Plugin<[], Root> {
	const minLength = options.minLength ?? 3;
	const skip = new Set<string>(DEFAULT_SKIP);
	for (const name of options.skipNames ?? []) {
		skip.add(name.toLowerCase());
	}

	// Build a single regex from all eligible canonical names. The lookup is
	// keyed by lowercased name so we can resolve a match back to its id.
	const names = Array.from(options.lookup.keys());
	const pattern = buildPattern(names, skip, minLength);

	return function transform(tree, file) {
		if (!pattern) return;

		// Per-file opt-out by HTML comment in the original source.
		const source = readFileSource(file);
		if (source && SKIP_COMMENT_PATTERN.test(source)) return;

		// Re-create the global regex per document so the per-text `lastIndex`
		// state doesn't leak across documents.
		const globalPattern = new RegExp(pattern.source, "gi");
		const linked = new Set<string>();

		visit(tree, "text", (node: Text, index, parent) => {
			if (index === undefined) return;
			if (shouldSkipParent(parent as LinkableTextParent | undefined)) {
				return SKIP;
			}
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
					// Either not a tracked tech name or already linked once in
					// this document — leave it as plain text but advance past it.
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
				segments.push({ type: "text", value: original.slice(cursor) });
			}

			const replacement = segments as Text[];
			(parent as Parent).children.splice(index, 1, ...replacement);
			return [SKIP, index + replacement.length];
		});
	};
}
