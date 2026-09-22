import { convertToTSX, parse } from "@astrojs/compiler";
import { compileScript, parse as parseVue, registerTS } from "vue/compiler-sfc";
import ts from "typescript";

registerTS(() => ts);

/**
 * Collect the JavaScript regions where Astro frontmatter recipes are used.
 * Client scripts have their own scope and may reuse a recipe variable's name.
 * This is source analysis, not HTML sanitization: no output is rendered.
 */
export async function getAstroRecipeSource(source) {
	const { ast, diagnostics } = await parse(source, { position: true });
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 1);
	if (errors.length)
		throw new Error(errors.map((error) => error.text).join("\n"));
	// Astro's TSX converter can wrap an HTML comment and its adjacent element
	// in separate fragments inside one conditional branch. Omit only parser-
	// identified comments before conversion, never comment-like text in JS.
	const comments = [];
	const bytes = Buffer.from(source);
	function collectComments(node) {
		if (node.type === "comment") {
			// Compiler offsets are UTF-8 bytes; String.slice uses UTF-16 units.
			const start = bytes
				.subarray(0, node.position.start.offset - 4)
				.toString().length;
			const end = bytes.subarray(0, node.position.end.offset).toString().length;
			if (source.slice(start, end) !== `<!--${node.value}-->`) {
				throw new Error("Unexpected Astro comment source range");
			}
			comments.push({ start, end });
		}
		for (const child of node.children ?? []) collectComments(child);
	}
	collectComments(ast);
	for (const { start, end } of comments.sort((a, b) => b.start - a.start)) {
		source = source.slice(0, start) + source.slice(end);
	}
	// Keep whole expressions and their lexical scopes. Joining text fragments
	// around nested Astro markup can turn valid expressions into invalid JS.
	const result = await convertToTSX(source, {
		includeScripts: false,
		includeStyles: false,
	});
	return result.code;
}

/**
 * Find imported recipe calls and statically named member accesses, not text
 * resembling them. The in-memory checker resolves local bindings/shadowing;
 * it neither loads dependencies nor performs the application's typecheck.
 * Dynamic computed keys are deliberately left to the normal typecheck.
 */
export async function getRecipeUsage(source, extension = ".ts") {
	let code = source;
	let scriptKind = extension === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
	if (extension === ".astro") code = await getAstroRecipeSource(source);
	if (extension === ".vue") {
		const { descriptor, errors } = parseVue(source, {
			filename: "academy-source.vue",
		});
		if (errors.length) throw new Error(errors.map(String).join("\n"));
		if (!descriptor.script && !descriptor.scriptSetup)
			return { imports: [], accesses: [] };
		scriptKind = [
			descriptor.script?.lang,
			descriptor.scriptSetup?.lang,
		].includes("tsx")
			? ts.ScriptKind.TSX
			: ts.ScriptKind.TS;
		// Inline compilation preserves setup bindings and template-local scopes
		// (for example a v-for variable shadowing a recipe variable).
		code = compileScript(descriptor, {
			id: "academy-source",
			inlineTemplate: true,
		}).content;
	}
	const filename =
		scriptKind === ts.ScriptKind.TS
			? "academy-source.ts"
			: "academy-source.tsx";
	const file = ts.createSourceFile(
		filename,
		code,
		ts.ScriptTarget.Latest,
		true,
		scriptKind,
	);
	if (file.parseDiagnostics.length) {
		throw new Error(
			file.parseDiagnostics
				.map((diagnostic) =>
					ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
				)
				.join("\n"),
		);
	}
	const program = ts.createProgram(
		[filename],
		{ noLib: true, noResolve: true },
		{
			getSourceFile: (name) => (name === filename ? file : undefined),
			getDefaultLibFileName: () => "",
			writeFile: () => {},
			getCurrentDirectory: () => "",
			getDirectories: () => [],
			fileExists: (name) => name === filename,
			readFile: (name) => (name === filename ? code : undefined),
			getCanonicalFileName: (name) => name,
			useCaseSensitiveFileNames: () => true,
			getNewLine: () => "\n",
		},
	);
	const checker = program.getTypeChecker();
	const bindings = new Map();
	const imports = [];
	for (const statement of file.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier)
		)
			continue;
		const named = statement.importClause?.namedBindings;
		if (!named || !ts.isNamedImports(named)) continue;
		for (const specifier of named.elements) {
			const binding = {
				module: statement.moduleSpecifier.text,
				imported: (specifier.propertyName ?? specifier.name).text,
				typeOnly: Boolean(
					statement.importClause.isTypeOnly || specifier.isTypeOnly,
				),
			};
			bindings.set(checker.getSymbolAtLocation(specifier.name), binding);
			if (/^@rawkodeacademy\/design-system(?:\/vue)?$/.test(binding.module))
				imports.push(binding);
		}
	}
	function recipeFor(node, seen = new Set()) {
		if (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isNonNullExpression(node) ||
			ts.isSatisfiesExpression(node)
		) {
			return recipeFor(node.expression, seen);
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const binding = bindings.get(
				checker.getSymbolAtLocation(node.expression),
			);
			if (
				binding?.module === "vue" &&
				binding.imported === "unref" &&
				node.arguments.length === 1
			) {
				return recipeFor(node.arguments[0], seen);
			}
			if (binding && !binding.typeOnly && imports.includes(binding))
				return binding;
		}
		if (ts.isIdentifier(node)) {
			const symbol = checker.getSymbolAtLocation(node);
			if (!symbol || seen.has(symbol)) return;
			seen.add(symbol);
			const declaration = symbol.valueDeclaration;
			if (
				declaration &&
				ts.isVariableDeclaration(declaration) &&
				declaration.initializer
			) {
				return recipeFor(declaration.initializer, seen);
			}
		}
	}
	const accesses = [];
	function visit(node) {
		let slot;
		if (ts.isPropertyAccessExpression(node)) slot = node.name.text;
		if (
			ts.isElementAccessExpression(node) &&
			node.argumentExpression &&
			(ts.isStringLiteral(node.argumentExpression) ||
				ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
		) {
			slot = node.argumentExpression.text;
		}
		if (slot !== undefined) {
			const recipe = recipeFor(node.expression);
			if (recipe) accesses.push({ ...recipe, slot });
		}
		ts.forEachChild(node, visit);
	}
	visit(file);
	return { imports, accesses };
}
