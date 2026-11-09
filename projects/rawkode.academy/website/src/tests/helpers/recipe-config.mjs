import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const recipesUrl = new URL(
	"../../../../../../packages/design-system/src/recipes/",
	import.meta.url,
);

const transpile = (source) =>
	ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;

/**
 * Evaluate a design-system recipe and return the raw config it passes to
 * `sva` / `cva`, so a test can assert on authored style values rather than
 * generated class names. Shared style fragments (`../styles/*`) are evaluated
 * from source; nothing else may be imported by a recipe.
 */
export async function readRecipeConfig(file, exportName) {
	const context = vm.createContext({});
	const load = async (url) => {
		const module = new vm.SourceTextModule(
			transpile(readFileSync(url, "utf8")),
			{
				context,
				identifier: url.href,
			},
		);
		await module.link(async (specifier, referencing) => {
			if (specifier === "../../styled-system/css") {
				return new vm.SyntheticModule(
					["sva", "cva"],
					function () {
						this.setExport("sva", (config) => config);
						this.setExport("cva", (config) => config);
					},
					{ context },
				);
			}
			if (specifier.startsWith("../styles/")) {
				return load(new URL(`${specifier}.ts`, referencing.identifier));
			}
			throw new Error(`Unexpected recipe import: ${specifier}`);
		});
		return module;
	};
	const module = await load(new URL(file, recipesUrl));
	await module.evaluate();
	return module.namespace[exportName];
}
