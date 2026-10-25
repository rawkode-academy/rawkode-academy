import { type InlineNode, MARK_ORDER, type Mark, type TextNode } from "./types";

// ProseMirror stores marks flat on each text node; HTML and Markdown need them
// nested. This rebuilds the nesting: a mark stays open while the following
// nodes still carry it, so `<sup> [§](#x)</sup>` comes back as sup > link.
export type InlineTree =
	| { kind: "leaf"; node: InlineNode }
	| { kind: "mark"; mark: Mark; children: InlineTree[] };

export function sameMark(a: Mark, b: Mark): boolean {
	if (a.type !== b.type) return false;
	if (a.type === "link" && b.type === "link") {
		return (
			a.attrs.href === b.attrs.href &&
			a.attrs.target === b.attrs.target &&
			a.attrs.rel === b.attrs.rel &&
			a.attrs.class === b.attrs.class &&
			a.attrs.title === b.attrs.title
		);
	}
	return true;
}

const rank = (mark: Mark) => MARK_ORDER.indexOf(mark.type);

export function sortMarks(marks: Mark[]): Mark[] {
	return [...marks].sort((a, b) => rank(a) - rank(b));
}

export function groupInline(content: InlineNode[] = []): InlineTree[] {
	const root: InlineTree[] = [];
	const stack: { mark: Mark; children: InlineTree[] }[] = [];
	const top = () => stack.at(-1)?.children ?? root;

	for (const node of content) {
		// Breaks carry no marks; keep the current marks open across them.
		if (node.type !== "text") {
			top().push({ kind: "leaf", node });
			continue;
		}
		// code is never a group: Markdown's inlineCode is a leaf, so it wraps
		// each text node individually (renderers read it from the leaf's marks).
		const marks = (node.marks ?? []).filter((mark) => mark.type !== "code");
		let keep = 0;
		while (
			keep < stack.length &&
			marks.some((mark) => sameMark(mark, stack[keep]!.mark))
		) {
			keep++;
		}
		stack.length = keep;
		const open = sortMarks(
			marks.filter((mark) => !stack.some((s) => sameMark(s.mark, mark))),
		);
		for (const mark of open) {
			const group = { mark, children: [] as InlineTree[] };
			top().push({ kind: "mark", ...group });
			stack.push(group);
		}
		top().push({ kind: "leaf", node });
	}
	return root;
}

// Canonical inline content: marks sorted, adjacent equal-mark text merged,
// empty text removed. ProseMirror rejects empty text nodes.
export function normaliseInline(content: InlineNode[]): InlineNode[] {
	const out: InlineNode[] = [];
	for (const node of content) {
		if (node.type === "text") {
			if (node.text === "") continue;
			const marks = sortMarks(node.marks ?? []);
			const previous = out.at(-1);
			if (previous?.type === "text" && sameMarks(previous.marks ?? [], marks)) {
				previous.text += node.text;
				continue;
			}
			const text: TextNode = { type: "text", text: node.text };
			if (marks.length > 0) text.marks = marks;
			out.push(text);
		} else {
			out.push(node);
		}
	}
	return out;
}

function sameMarks(a: Mark[], b: Mark[]): boolean {
	return a.length === b.length && a.every((mark, i) => sameMark(mark, b[i]!));
}

export function inlineText(content: InlineNode[] = []): string {
	return content
		.map((node) => (node.type === "text" ? node.text : ""))
		.join("");
}
