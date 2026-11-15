import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Support for the "every class has CSS" guard in design-tokens.test.ts.
 *
 * The website has no utility-CSS compiler, so a class only does something
 * when a rule that reaches the element names it. A rule reaches an element
 * when it is global (the built design-system stylesheet, global.css, an
 * unscoped style block, a `:global()` or `:deep()` selector) or when it sits
 * in the same file's own scoped style block.
 */

// Course material under webcontainer-demos is served to a sandbox, never
// loaded by the site, so its CSS and markup are not the site's.
const SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	".astro",
	"generated",
	"webcontainer-demos",
]);

export function* walkFiles(
	dir: string,
	extensions: readonly string[],
): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) {
				yield* walkFiles(join(dir, entry.name), extensions);
			}
		} else if (extensions.some((ext) => entry.name.endsWith(ext))) {
			yield join(dir, entry.name);
		}
	}
}

// Class selectors as written in CSS escape punctuation with a backslash.
const CLASS_SELECTOR = /\.(-?[_a-zA-Z](?:\\.|[\w-])*)/g;
const STYLE_BLOCK = /<style\b([^>]*)>([\s\S]*?)<\/style>/g;
// The part of a scoped selector that escapes the scope.
const ESCAPED_SCOPE =
	/(?::global|:deep|::v-deep)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g;

const selectorClasses = (css: string): string[] =>
	Array.from(
		css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(CLASS_SELECTOR),
		(match) => match[1]!.replace(/\\(.)/g, "$1"),
	);

export interface ClassIndex {
	/** Names with a rule that applies on every page. */
	global: Set<string>;
	/** Names a file's own scoped style blocks define, by project-relative path. */
	local: Map<string, Set<string>>;
}

/** The style blocks of one component, split by how far their rules reach. */
export function styleBlockClasses(
	source: string,
	kind: "astro" | "vue",
): { global: string[]; local: string[] } {
	const global: string[] = [];
	const local: string[] = [];
	for (const [, attributes = "", css = ""] of source.matchAll(STYLE_BLOCK)) {
		// Astro scopes a block unless it says is:global; Vue scopes one only
		// when it says scoped.
		const scoped =
			kind === "astro"
				? !/\bis:global\b/.test(attributes)
				: /\bscoped\b/.test(attributes);
		if (!scoped) {
			global.push(...selectorClasses(css));
			continue;
		}
		local.push(...selectorClasses(css));
		for (const [, escaped = ""] of css.matchAll(ESCAPED_SCOPE)) {
			global.push(...selectorClasses(escaped));
		}
	}
	return { global, local };
}

/** Every class name the site ships a rule for, and how far each rule reaches. */
export function classIndex(projectRoot: string): ClassIndex {
	const global = new Set(
		selectorClasses(
			readFileSync(
				join(
					projectRoot,
					"../../../packages/design-system/styled-system/styles.css",
				),
				"utf-8",
			),
		),
	);
	const local = new Map<string, Set<string>>();
	const src = join(projectRoot, "src");
	for (const file of walkFiles(src, [".css"])) {
		for (const name of selectorClasses(readFileSync(file, "utf-8"))) {
			global.add(name);
		}
	}
	for (const file of walkFiles(src, [".astro", ".vue"])) {
		const classes = styleBlockClasses(
			readFileSync(file, "utf-8"),
			file.endsWith(".vue") ? "vue" : "astro",
		);
		for (const name of classes.global) global.add(name);
		if (classes.local.length > 0) {
			local.set(relative(projectRoot, file), new Set(classes.local));
		}
	}
	return { global, local };
}

export const isDefinedClass = (
	index: ClassIndex,
	relPath: string,
	token: string,
) => index.global.has(token) || (index.local.get(relPath)?.has(token) ?? false);

export interface ClassToken {
	token: string;
	line: number;
}

// A literal attribute: class="a b", className='a b'. A bound attribute
// (:class, class:list, className={...}) is an expression, handled below.
const STATIC_ATTRIBUTE =
	/(?<![:\w.-])(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const BOUND_ATTRIBUTE =
	/(?<![\w.-])(?:(?:v-bind)?:class\s*=\s*"([^"]*)"|(?:class:list|className|class)\s*=\s*\{)/g;
// Includes utility spellings (hover:bg-x, w-1/2, p-[3px]) so they are checked.
const CLASS_NAME = /^-?[_a-zA-Z][\w:/[\].%-]*$/;
// Helpers whose arguments are class names. Any other call takes values.
const CLASS_JOINERS = new Set(["cn", "clsx", "cx", "classNames", "twMerge"]);

const lineOf = (source: string, index: number) =>
	source.slice(0, index).split("\n").length;

/** The index just past the brace that closes the one at `open`. */
function closingBrace(source: string, open: number): number {
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		const char = source[i]!;
		if (char === '"' || char === "'" || char === "`") {
			for (i += 1; i < source.length && source[i] !== char; i += 1) {
				if (source[i] === "\\") i += 1;
			}
		} else if (char === "{") {
			depth += 1;
		} else if (char === "}") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return source.length;
}

/**
 * Class names a bound class expression can produce, read without running it:
 * - a string literal, wherever it sits in an array, a ternary or an `&&`;
 * - an object key or shorthand (`{ active: on }`, `{ quiet }`).
 * A string is a value, not a class, when it is a call argument
 * (`button("outline")`), a member key (`styles["root"]`), one side of a
 * comparison (`kind === "video"`), or an object's value. A template literal
 * with an interpolation cannot be read statically and is skipped.
 */
export function expressionClassNames(expression: string): string[] {
	const names: string[] = [];
	const stack: { open: string; value: boolean; key: boolean }[] = [];
	const inValue = () => stack.some((frame) => frame.value);
	const settle = () => {
		const top = stack.at(-1);
		if (top) top.key = false;
	};
	// The last thing read: "word", "string", "close" or the operator itself.
	let previous = "";
	let i = 0;
	while (i < expression.length) {
		const char = expression[i]!;
		if (/\s/.test(char)) {
			i += 1;
			continue;
		}
		const top = stack.at(-1);
		if (char === '"' || char === "'" || char === "`") {
			let value = "";
			let dynamic = false;
			let j = i + 1;
			while (j < expression.length && expression[j] !== char) {
				if (expression[j] === "\\") {
					value += expression[j + 1] ?? "";
					j += 2;
				} else if (
					char === "`" &&
					expression[j] === "$" &&
					expression[j + 1] === "{"
				) {
					dynamic = true;
					j = closingBrace(expression, j + 1);
				} else {
					value += expression[j];
					j += 1;
				}
			}
			const rest = expression.slice(j + 1).trimStart();
			const compared =
				/^[!=]==?/.test(rest) || /[!=]==?$/.test(previous) || previous === "in";
			const objectKey = top?.open === "{" && top.key && rest.startsWith(":");
			const objectValue = top?.open === "{" && !top.key;
			const candidates = value.split(/\s+/).filter(Boolean);
			if (
				!dynamic &&
				!compared &&
				!objectValue &&
				!(inValue() && !objectKey) &&
				candidates.every((name) => CLASS_NAME.test(name))
			) {
				names.push(...candidates);
			}
			previous = "string";
			settle();
			i = j + 1;
			continue;
		}
		if (/[A-Za-z_$]/.test(char)) {
			const word = /^[\w$]+(?:-[\w$]+)*/.exec(expression.slice(i))![0];
			// A hyphen only belongs to a word where one is a key: `a-b` is
			// otherwise a subtraction.
			const isKeyPosition =
				top?.open === "{" && top.key && !previous.endsWith(".");
			const read = isKeyPosition ? word : /^[\w$]+/.exec(word)![0];
			const rest = expression.slice(i + read.length).trimStart();
			if (isKeyPosition && !inValue() && /^[:,}]/.test(rest)) {
				names.push(read);
			}
			previous = CLASS_JOINERS.has(read)
				? "joiner"
				: read === "in"
					? "in"
					: "word";
			settle();
			i += read.length;
			continue;
		}
		if (char === "(" || char === "[" || char === "{") {
			// After a word or a closing bracket, a paren is a call and a
			// square bracket is a member key: both hold values, not classes.
			const afterOperand = previous === "word" || previous === "close";
			stack.push({
				open: char,
				value: char !== "{" && afterOperand,
				key: char === "{",
			});
			previous = char;
		} else if (char === ")" || char === "]" || char === "}") {
			stack.pop();
			previous = "close";
			settle();
		} else if (char === ",") {
			if (top) top.key = top.open === "{";
			previous = ",";
		} else {
			previous = /[^\w\s"'`()[\]{},]$/.test(previous) ? previous + char : char;
		}
		i += 1;
	}
	return names;
}

/**
 * Class names written literally in a template: every name in a literal
 * class attribute, and every name a bound attribute's expression can
 * produce (see expressionClassNames).
 */
export function staticClassTokens(source: string): ClassToken[] {
	const tokens: ClassToken[] = [];
	const blank = (block: string) => block.replace(/[^\n]/g, " ");
	// Astro frontmatter, scripts and styles are code, not markup.
	const template = source
		.replace(/^---\n[\s\S]*?\n---\n/, blank)
		.replace(
			/<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*(?<!\/)>[\s\S]*?<\/\1>/g,
			blank,
		);

	for (const match of template.matchAll(STATIC_ATTRIBUTE)) {
		const line = lineOf(template, match.index);
		for (const token of (match[1] ?? match[2] ?? "").split(/\s+/)) {
			if (CLASS_NAME.test(token)) tokens.push({ token, line });
		}
	}
	for (const match of template.matchAll(BOUND_ATTRIBUTE)) {
		const line = lineOf(template, match.index);
		const open = match.index + match[0].length - 1;
		const expression =
			match[1] ?? template.slice(open + 1, closingBrace(template, open) - 1);
		for (const token of expressionClassNames(expression)) {
			tokens.push({ token, line });
		}
	}
	return tokens;
}

const HTML_CLASS_ATTRIBUTE = /\bclass=(?:\\?"([^"\\]*)\\?"|'([^'\\]*)')/g;

/**
 * Class names in HTML that code builds as a string (`'<i class="x">'`), in a
 * .ts module or in a component's frontmatter or script. Markup made this way
 * carries no scope, so only a global rule can style it. Names built by
 * interpolation are skipped.
 */
export function htmlStringClassTokens(source: string): ClassToken[] {
	const tokens: ClassToken[] = [];
	for (const match of source.matchAll(HTML_CLASS_ATTRIBUTE)) {
		const line = lineOf(source, match.index);
		for (const token of (match[1] ?? match[2] ?? "").split(/\s+/)) {
			if (CLASS_NAME.test(token)) tokens.push({ token, line });
		}
	}
	return tokens;
}

/** The code regions of a component: Astro frontmatter and script blocks. */
export function codeRegions(source: string): string {
	const blank = (block: string) => block.replace(/[^\n]/g, " ");
	const frontmatter = /^---\n[\s\S]*?\n---\n/.exec(source)?.[0] ?? "";
	// Scripts are found after the frontmatter, which may mention a tag.
	const body = source.slice(frontmatter.length);
	let code = frontmatter;
	let end = 0;
	for (const match of body.matchAll(
		/<script\b(?:[^>"']|"[^"]*"|'[^']*')*(?<!\/)>[\s\S]*?<\/script>/g,
	)) {
		code += blank(body.slice(end, match.index)) + match[0];
		end = match.index + match[0].length;
	}
	return code + blank(body.slice(end));
}
