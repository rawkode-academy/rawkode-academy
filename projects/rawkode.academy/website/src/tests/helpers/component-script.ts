import { readFileSync } from "node:fs";
import { parse } from "@astrojs/compiler";
import ts from "typescript";

type AstroNode = {
	type: string;
	name?: string;
	value?: string;
	children?: AstroNode[];
};

/**
 * Return the transpiled body of an Astro component's client `<script>`.
 * The component is parsed with the Astro compiler so the script boundary is
 * the parser's, not a regular expression's. This is test scaffolding, not
 * HTML sanitisation: the result is executed in a test, never rendered.
 */
export async function readComponentScript(path: string): Promise<string> {
	const source = readFileSync(path, "utf8");
	const { ast, diagnostics } = await parse(source, { position: false });
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 1);
	if (errors.length)
		throw new Error(errors.map((error) => error.text).join("\n"));
	const scripts: string[] = [];
	const visit = (node: AstroNode) => {
		if (node.type === "element" && node.name?.toLowerCase() === "script") {
			scripts.push(
				(node.children ?? [])
					.filter((child) => child.type === "text")
					.map((child) => child.value ?? "")
					.join(""),
			);
		}
		for (const child of node.children ?? []) visit(child);
	};
	visit(ast as AstroNode);
	const script = scripts.find((body) => body.trim().length > 0);
	if (!script) throw new Error(`${path}: client script missing`);
	return ts.transpileModule(script, {
		compilerOptions: { target: ts.ScriptTarget.ES2022 },
	}).outputText;
}
