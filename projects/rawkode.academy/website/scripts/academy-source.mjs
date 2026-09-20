import { parse } from "@astrojs/compiler";

/**
 * Collect the JavaScript regions where Astro frontmatter recipes are used.
 * Client scripts have their own scope and may reuse a recipe variable's name.
 * This is source analysis, not HTML sanitization: no output is rendered.
 */
export async function getAstroRecipeSource(source) {
	const { ast, diagnostics } = await parse(source);
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 1);
	if (errors.length) throw new Error(errors.map((error) => error.text).join("\n"));
	const fragments = [];
	function visit(node, parent) {
		if (node.type === "element" && ["script", "style"].includes(node.name.toLowerCase())) return;
		if (node.type === "frontmatter" || (node.type === "text" && parent?.type === "expression")) {
			fragments.push(node.value);
		}
		for (const attribute of node.attributes ?? []) {
			if (["expression", "spread", "shorthand"].includes(attribute.kind)) fragments.push(attribute.value);
		}
		for (const child of node.children ?? []) visit(child, node);
	}
	visit(ast);
	return fragments.join("\n");
}
