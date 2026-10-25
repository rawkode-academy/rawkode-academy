// SmartyPants-equivalent typography over a document's prose, replacing
// Astro's default remark-smartypants: curly quotes, apostrophes, `` '' quotes,
// em dashes for "--"/"---" and an ellipsis for "...". Code (marks and blocks)
// is left alone. Quote direction looks at the previous character across text
// node boundaries, so a quote that opens before a bold run still opens.
import type {
	AnyNode,
	DocNode,
	InlineNode,
	TextNode,
} from "@rawkodeacademy/rich-text";

const OPENING_CONTEXT = /[\s([{—–“‘-]/;
const WORD = /[\p{L}\p{N}]/u;

function isCode(node: TextNode): boolean {
	return node.marks?.some((mark) => mark.type === "code") ?? false;
}

export function educate(text: string, previous: string): string {
	let out = text
		.replace(/\.\.\.|\. \. \./g, "…")
		.replace(/---|--/g, "—")
		.replace(/``/g, "“")
		.replace(/''/g, "”");
	let result = "";
	let prev = previous;
	for (let i = 0; i < out.length; i++) {
		const ch = out.charAt(i);
		const next = out[i + 1] ?? "";
		if (ch === '"') {
			const opening = prev === "" || OPENING_CONTEXT.test(prev);
			result += opening ? "“" : "”";
		} else if (ch === "'") {
			if (WORD.test(prev) && WORD.test(next)) {
				result += "’"; // don't, it's
			} else if (
				(prev === "" || OPENING_CONTEXT.test(prev)) &&
				/^\d\ds\b/.test(out.slice(i + 1, i + 5))
			) {
				result += "’"; // '90s
			} else if (prev === "" || OPENING_CONTEXT.test(prev)) {
				result += "‘";
			} else {
				result += "’";
			}
		} else {
			result += ch;
		}
		prev = ch;
	}
	out = result;
	return out;
}

const SKIP_BLOCKS = new Set([
	"codeBlock",
	"diagram",
	"embed",
	"video",
	"interactive",
	"image",
]);

function educateInline(
	content: InlineNode[] | undefined,
): InlineNode[] | undefined {
	if (!content) return content;
	let previous = "";
	return content.map((node) => {
		if (node.type === "hardBreak") {
			previous = " ";
			return node;
		}
		if (isCode(node)) {
			previous = node.text.slice(-1);
			return node;
		}
		const text = educate(node.text, previous);
		previous = node.text.slice(-1);
		return text === node.text ? node : { ...node, text };
	});
}

function transform<N extends AnyNode>(node: N): N {
	if (SKIP_BLOCKS.has(node.type)) return node;
	if (node.type === "paragraph" || node.type === "heading") {
		const content = educateInline((node as { content?: InlineNode[] }).content);
		return content ? ({ ...node, content } as N) : node;
	}
	if ("content" in node && Array.isArray(node.content)) {
		return {
			...node,
			content: (node.content as AnyNode[]).map((child) => transform(child)),
		} as N;
	}
	return node;
}

export function smartypants(doc: DocNode): DocNode {
	return transform(doc);
}
