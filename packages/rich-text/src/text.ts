import type { AnyNode, BlockNode, DocNode, InlineNode } from "./types";

export interface TextOptions {
	// Include code block contents (default true). Search indexes may not want them.
	code?: boolean;
}

function inline(content: InlineNode[] = []): string {
	return content
		.map((node) => (node.type === "text" ? node.text : "\n"))
		.join("");
}

// Plain text for search, social posts and transcription keyterms: one block
// per paragraph, list items on their own lines, no markup.
export function toText(
	node: DocNode | AnyNode,
	options: TextOptions = {},
): string {
	const code = options.code ?? true;

	const blocks = (nodes: AnyNode[]): string[] => nodes.flatMap(block);

	const block = (node: AnyNode): string[] => {
		switch (node.type) {
			case "text":
			case "hardBreak":
				return [inline([node])];
			case "paragraph":
			case "heading":
				return [inline(node.content)];
			case "codeBlock":
				return code ? [node.content?.[0]?.text ?? ""] : [];
			case "bulletList":
			case "orderedList":
			case "taskList":
				return [
					node.content
						.map((item) => blocks(item.content).join("\n"))
						.join("\n"),
				];
			case "table":
				return [
					node.content
						.map((row) =>
							row.content
								.map((cell) => blocks(cell.content).join(" "))
								.join("\t"),
						)
						.join("\n"),
				];
			case "image":
				return node.attrs.alt ? [node.attrs.alt] : [];
			case "diagram":
				return [node.attrs.title, node.attrs.description].filter(
					(value): value is string => Boolean(value),
				);
			case "embed":
				return node.attrs.title ? [node.attrs.title] : [];
			case "horizontalRule":
			case "video":
			case "interactive":
				return [];
			default:
				return blocks((node.content ?? []) as BlockNode[]);
		}
	};

	return block(node)
		.map((text) => text.trim())
		.filter(Boolean)
		.join("\n\n");
}
