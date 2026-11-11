import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
	classIndex,
	codeRegions,
	expressionClassNames,
	htmlStringClassTokens,
	isDefinedClass,
	staticClassTokens,
	styleBlockClasses,
	walkFiles,
} from "./helpers/class-tokens";

/**
 * Design-system guards. Source scans that point CI at the offending file:
 * - raw Tailwind gray-* utilities and the retired --editorial-* / --brand-*
 *   aliases, which bypass the shared light/dark palette;
 * - raw colours (hex or a colour function) anywhere in src, outside a short
 *   allowlist and a counted baseline that may only shrink;
 * - custom properties that nothing defines;
 * - class names that no stylesheet rule reaches (the site has no utility-CSS
 *   compiler, and a scoped style stops at its own file).
 * It also protects the public shell's font and branding contracts.
 */

const SCAN_ROOTS = ["src", ".storybook"];
const SCAN_EXTENSIONS = [
	".astro",
	".vue",
	".tsx",
	".jsx",
	".ts",
	".js",
	".mdx",
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", "generated"]);
const SKIP_FILES = new Set(["src/tests/design-tokens.test.ts"]);

const BANNED_PATTERN =
	/(?:bg|text|border|divide|ring|outline|decoration|from|to|via|fill|stroke|placeholder|caret|accent|shadow)-gray-\d+(?:\/\d+)?/g;

// The alias layer these prefixes belonged to is gone from global.css, so any
// use is a reference to a variable that no longer exists.
const LEGACY_ALIAS = /--(?:editorial|brand)-[a-z0-9-]+/g;

// A name that ends in a hyphen is a prefix in prose or an interpolation.
const CUSTOM_PROPERTY_USE = /var\(\s*(--[\w-]*\w)(?![\w-]|\$\{|\*)/g;
// A declaration (`--x: 1`, `"--x": 1`, `'--x': v`) or a setProperty call.
const CUSTOM_PROPERTY_DEFINITION =
	/(--[\w-]+)["'`]?\s*:|setProperty\(\s*["'`](--[\w-]+)/g;
/**
 * Custom properties something outside the site's own CSS provides. One
 * entry per name, with who sets it.
 */
const PROVIDED_CUSTOM_PROPERTIES: Record<string, string> = {
	"--font-red-hat-display": "Astro's font integration (astro.config.mts)",
	"--font-red-hat-text": "Astro's font integration (astro.config.mts)",
	"--font-red-hat-mono": "Astro's font integration (astro.config.mts)",
	"--reference-width": "Ark UI positioner",
	"--available-height": "Ark UI positioner",
	"--height": "Ark UI collapsible content",
};

// The lookbehind drops HTML numeric entities (&#123;) and mid-word hashes.
const HEX_COLOUR =
	/(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
// The same colour spelt as a function: rgb(239, 68, 68), oklch(0.2 0.01 280).
// A colour derived from a variable (rgb(from var(--x) ...)) is not a literal.
const COLOUR_FUNCTION =
	/\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(\s*[\d.]+/g;
// Fragment links and id references can spell a hex-looking word (#facade).
const FRAGMENT_REFERENCE =
	/(?:href|to|id|for|aria-[a-z]+|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})|url\(#[^)]*\)/g;
/**
 * The only places a literal hex colour is correct, by file and by the kind
 * of line it may sit on. Everything else reads var(--colors-academy-*).
 */
const HEX_ALLOWLIST: Record<string, RegExp> = {
	// Browser-chrome meta tags cannot read a CSS variable.
	"src/components/html/head.astro":
		/\b(?:color|content|data-(?:light|dark)-color)="#/,
	"src/layouts/minimal.astro": /\b(?:content|data-(?:light|dark)-color)="#/,
	// The brand page documents the palette values and tints logo downloads.
	"src/pages/organizations/branding/index.astro":
		/\bvalue: "#|academyLogoDownload\(/,
	// The logo download's two inks are part of its type.
	"src/lib/branding.ts": /\bcolor: "#0c1626" \| "#ffffff"/,
	// Code blocks are a dark terminal in both schemes; these are its tokens.
	"src/styles/global.css": /^\s*--terminal-[\w-]+:/,
	"src/lib/live-content/render/code.ts": /\bterminalTitlebarDotsForeground:/,
};

/**
 * Raw colours that predate the guard, by file: the exact number of literals
 * left. The count may only go down. Lower it when you remove one and delete
 * the entry at zero; a new literal anywhere fails.
 */
const COLOUR_BASELINE: Record<string, { count: number; reason: string }> = {
	"src/lib/explorer/dimension-values.ts": {
		count: 62,
		reason: "explorer category palette, not yet academy.* tokens",
	},
	"src/lib/theme.ts": {
		count: 5,
		reason: "legacy palette behind getThemeColors(), pinned by theme.test.ts",
	},
	"src/lib/system-canvas.ts": {
		count: 5,
		reason: "canvas fallbacks for when a token variable cannot be read",
	},
	"src/components/explorer/TechnologyExplorer.vue": {
		count: 3,
		reason: "floating-layer shadows",
	},
	"src/components/explorer/controls/MultiSelectFilter.vue": {
		count: 1,
		reason: "floating-layer shadow",
	},
	"src/components/explorer/views/GridView.vue": {
		count: 2,
		reason: "ink on a category colour",
	},
	"src/pages/supporters.astro": {
		count: 2,
		reason: "paper plate behind supporter logos, the same in both schemes",
	},
};

/**
 * Class names with no rule in the site's own CSS that are still correct:
 * a third-party stylesheet styles them, or a script selects on them. One
 * entry per name, with the reason.
 */
const UNSTYLED_CLASS_ALLOWLIST: Record<string, string> = {
	"vds-poster": "styled by vidstack/player/styles, imported in player.vue",
};

/**
 * Class names a parent's scoped style reaches in another file. Vue applies a
 * parent's scoped rules to a child component's root element, which a
 * per-file scan cannot see. By file, with the parent that styles it.
 */
const INHERITED_CLASS_ALLOWLIST: Record<string, string[]> = {};

// Vitest runs with cwd at the website project root; import.meta.url is not
// usable here because Vite serves transformed modules behind an /@fs prefix.
const projectRoot = process.cwd();
const readSource = (path: string) =>
	readFileSync(join(projectRoot, path), "utf-8");
const shellRecipe = () =>
	readSource("../../../packages/design-system/src/recipes/academyShell.ts");

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
		} else if (SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
			yield join(dir, entry.name);
		}
	}
}

describe("design tokens", () => {
	it("composes Academy chrome once in the app layout", () => {
		const appLayout = readFileSync(
			join(projectRoot, "src/layouts/app.astro"),
			"utf-8",
		);

		for (const component of ["AcademyHeader", "AcademyFooter"]) {
			expect(appLayout).toContain(`@/components/shell/${component}.astro`);
			expect(
				appLayout.match(new RegExp(`<${component}\\s*/>`, "g")),
			).toHaveLength(1);
		}
		expect(appLayout).toContain("academyShell()");
		expect(appLayout).toContain('data-ui-shell="panda-v2"');
		expect(appLayout).toContain('href="#main-content"');
		expect(appLayout).toMatch(
			/<main\b[^>]*id="main-content"[^>]*tabindex="-1"/,
		);
		expect(appLayout).not.toContain("PublicationNav");
		expect(appLayout).not.toContain("components/sidebar/Sidebar.astro");
		expect(readSource("src/wrappers/page.astro")).toContain(
			'"@rawkodeacademy/design-system/styles.css"',
		);
	});

	it("keeps control font resets in the shared reset layer, below Panda recipes", () => {
		const pageWrapper = readSource("src/wrappers/page.astro");
		// Unlayered global declarations outrank every layered Panda control style.
		expect(pageWrapper).not.toMatch(/<style\b[^>]*\bis:global\b/);

		const globalCss = readSource("src/styles/global.css").replace(
			/\/\*[\s\S]*?\*\//g,
			"",
		);
		// Bound the match to this flat reset block; don't accept a later unlayered rule.
		const reset = globalCss.match(
			/@layer\s+reset\s*\{((?:[^{}]|\{[^{}]*\})*)\}/,
		)?.[1];
		expect(
			reset,
			"Shared @layer reset must own the control font reset",
		).toBeDefined();
		const rules = [...(reset ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)];
		for (const control of ["button", "input", "select", "textarea"]) {
			expect(
				rules.some(
					([, selectors, declarations]) =>
						(selectors ?? "")
							.split(",")
							.map((selector) => selector.trim())
							.includes(control) &&
						/(?:^|;)\s*font\s*:\s*inherit\s*(?:;|$)/.test(declarations ?? ""),
				),
				`${control} must inherit its font inside @layer reset`,
			).toBe(true);
		}
	});

	it("keeps the applied color scheme authoritative", () => {
		const globalCss = readFileSync(
			join(projectRoot, "src/styles/global.css"),
			"utf-8",
		);
		const pageWrapper = readFileSync(
			join(projectRoot, "src/wrappers/page.astro"),
			"utf-8",
		);

		expect(globalCss).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*light;/);
		expect(globalCss).toMatch(/html\.dark\s*\{[\s\S]*?color-scheme:\s*dark;/);
		expect(pageWrapper).not.toContain("color-scheme: light dark");
		const recipe = shellRecipe();
		expect(recipe).toContain('backgroundColor: "academy.canvas"');
		expect(recipe).toContain('backgroundColor: "academy.ground"');
		expect(recipe).toContain('color: "academy.text"');
		expect(recipe).not.toContain("--terminal-");
		// The document base reads the Panda palette directly, so both colour
		// schemes inherit it; the retired alias layer must not come back.
		const body = globalCss.match(/(?:^|\n)body\s*\{([^}]*)\}/)?.[1] ?? "";
		expect(body).toContain("background-color: var(--colors-academy-canvas);");
		expect(body).toContain("color: var(--colors-academy-text);");
		expect(globalCss).not.toMatch(
			/--(?:editorial|surface|brand|utility|radius|duration|ease|shadow|space|layout|type)-[a-z]|--text-(?:primary-content|secondary-content|muted)\b|--font-(?:instrument-serif|inter-tight|jetbrains-mono)\b|\[class~=/,
		);
	});

	it("connects the Red Hat font providers, document loading, and recipe tokens", () => {
		const head = readSource("src/components/html/head.astro");
		const astroConfig = readSource("astro.config.mts");
		const pandaConfig = readSource(
			"../../../packages/design-system/panda.config.ts",
		);
		const fontTags = head.match(/<Font\b[^>]*\/>/g) ?? [];
		expect(fontTags).toHaveLength(3);
		for (const [role, family] of [
			["display", "Display"],
			["text", "Text"],
			["mono", "Mono"],
		]) {
			const variable = `--font-red-hat-${role}`;
			expect(astroConfig).toMatch(
				new RegExp(
					`name:\\s*"Red Hat ${family}",\\s*cssVariable:\\s*"${variable}"`,
				),
			);
			const tags = fontTags.filter((tag) =>
				tag.includes(`cssVariable="${variable}"`),
			);
			expect(tags).toHaveLength(1);
			expect(/\bpreload\b/.test(tags[0] ?? "")).toBe(role !== "mono");
			expect(pandaConfig).toMatch(
				new RegExp(
					`"academy-${role}":\\s*\\{\\s*value:\\s*'var\\(${variable}, "Red Hat ${family}"\\)`,
				),
			);
		}
		expect(shellRecipe()).toContain('fontFamily: "academy-text"');
		expect(readSource("src/styles/global.css")).toMatch(
			/body\s*\{[^}]*font-family:\s*var\(--(?:font-red-hat-text|fonts-academy-text)\)/,
		);
	});

	it("uses the real public wordmark with one accessible home-link name", () => {
		for (const component of ["AcademyHeader", "AcademyFooter"]) {
			const source = readSource(`src/components/shell/${component}.astro`);
			expect(source).toContain('"@/components/branding/AcademyBrand.astro"');
			expect(source).toMatch(/<AcademyBrand\s*\/>/);
		}
		const brand = readSource("src/components/branding/AcademyBrand.astro");
		expect(brand).toContain('import wordmark from "./logos/wordmark.svg?raw"');
		expect(brand).toMatch(
			/<a\b[^>]*href="\/"[^>]*aria-label="Rawkode Academy home"/,
		);
		expect(brand).toMatch(
			/<span\b[^>]*aria-hidden="true"[^>]*set:html=\{artwork\}/,
		);
		expect(readSource("src/components/branding/logos/wordmark.svg")).toContain(
			"<svg",
		);
		expect(shellRecipe()).toMatch(/"& path":\s*\{\s*fill:\s*"currentColor"/);
	});

	it("uses semantic tokens instead of raw gray-* utilities", () => {
		const violations: string[] = [];

		for (const root of SCAN_ROOTS) {
			for (const file of walk(join(projectRoot, root))) {
				const relPath = relative(projectRoot, file);
				if (SKIP_FILES.has(relPath)) continue;

				const lines = readFileSync(file, "utf-8").split("\n");
				lines.forEach((line, index) => {
					const matches = line.match(BANNED_PATTERN);
					if (matches) {
						violations.push(
							`${relPath}:${index + 1} — ${[...new Set(matches)].join(", ")}`,
						);
					}
				});
			}
		}

		expect(
			violations,
			`Raw gray-* utilities found. The website has no utility-CSS compiler; ` +
				`use a design-system recipe slot, or a scoped style reading the ` +
				`Academy variables (var(--colors-academy-*)):\n` +
				violations.join("\n"),
		).toEqual([]);
	});

	it("does not use the retired --editorial-* and --brand-* aliases", () => {
		const violations: string[] = [];
		for (const root of SCAN_ROOTS) {
			for (const file of walkFiles(join(projectRoot, root), [
				...SCAN_EXTENSIONS,
				".css",
				".mjs",
			])) {
				const relPath = relative(projectRoot, file);
				// Tests name the aliases in order to ban them.
				if (relPath.startsWith("src/tests/")) continue;
				readFileSync(file, "utf-8")
					.split("\n")
					.forEach((line, index) => {
						const matches = line.match(LEGACY_ALIAS);
						if (matches) {
							violations.push(
								`${relPath}:${index + 1}: ${[...new Set(matches)].join(", ")}`,
							);
						}
					});
			}
		}

		expect(
			violations,
			"Retired alias variables found. Use var(--colors-academy-*) in a " +
				`component <style>, or a design-system recipe token:\n${violations.join("\n")}`,
		).toEqual([]);
	});

	it("only reads custom properties that something defines", () => {
		const definitions = (source: string) =>
			Array.from(
				source.matchAll(CUSTOM_PROPERTY_DEFINITION),
				(match) => match[1] ?? match[2] ?? "",
			);
		const shared = new Set([
			...definitions(
				readSource("../../../packages/design-system/styled-system/styles.css"),
			),
			...definitions(readSource("src/styles/global.css")),
		]);
		expect(shared.has("--colors-academy-text")).toBe(true);
		// The retired alias layer must stay undefined, or this check is blind.
		for (const retired of ["--surface-border", "--radius-md", "--text-muted"]) {
			expect(shared.has(retired), retired).toBe(false);
		}

		const violations: string[] = [];
		const used = new Set<string>();
		let scanned = 0;
		for (const root of SCAN_ROOTS) {
			for (const file of walkFiles(join(projectRoot, root), [
				...SCAN_EXTENSIONS,
				".css",
				".mjs",
			])) {
				const relPath = relative(projectRoot, file);
				// Tests name retired variables in order to ban them.
				if (relPath.startsWith("src/tests/")) continue;
				const source = readFileSync(file, "utf-8");
				const own = new Set(definitions(source));
				source.split("\n").forEach((line, index) => {
					for (const [, name = ""] of line.matchAll(CUSTOM_PROPERTY_USE)) {
						scanned += 1;
						if (shared.has(name) || own.has(name)) continue;
						if (name in PROVIDED_CUSTOM_PROPERTIES) {
							used.add(name);
							continue;
						}
						violations.push(`${relPath}:${index + 1}: ${name}`);
					}
				});
			}
		}

		expect(scanned).toBeGreaterThan(500);
		expect(
			violations,
			"Custom properties that nothing defines, so the declaration is " +
				"dropped. Read the Panda variable for an academy.* token " +
				"(var(--colors-academy-*), var(--radii-academy-*)) or define the " +
				`property in the same file:\n${violations.join("\n")}`,
		).toEqual([]);
		expect(
			Object.keys(PROVIDED_CUSTOM_PROPERTIES).filter((name) => !used.has(name)),
			"Provided custom properties that are no longer read; delete the entry",
		).toEqual([]);
	});

	it("keeps raw colours out of the site's source", () => {
		const violations: string[] = [];
		const counts = new Map<string, number>();
		for (const file of walkFiles(join(projectRoot, "src"), [
			".astro",
			".vue",
			".tsx",
			".jsx",
			".ts",
			".css",
		])) {
			const relPath = relative(projectRoot, file);
			if (
				// Stories document token values; tests name colours to check them.
				relPath.includes(".stories.") ||
				relPath.startsWith("src/tests/") ||
				/\.(?:test|d)\.ts$/.test(relPath)
			) {
				continue;
			}
			const allowed = HEX_ALLOWLIST[relPath];
			readFileSync(file, "utf-8")
				.split("\n")
				.forEach((line, index) => {
					const text = line.replace(FRAGMENT_REFERENCE, "");
					const matches = [
						...(text.match(HEX_COLOUR) ?? []),
						...(text.match(COLOUR_FUNCTION) ?? []),
					];
					if (matches.length === 0 || allowed?.test(line)) return;
					counts.set(relPath, (counts.get(relPath) ?? 0) + matches.length);
					if (!(relPath in COLOUR_BASELINE)) {
						violations.push(
							`${relPath}:${index + 1}: ${[...new Set(matches)].join(", ")}`,
						);
					}
				});
		}

		expect(
			violations,
			"Raw colours found (hex, rgb(), oklch() and the like). Use " +
				"var(--colors-academy-*) or a recipe token; browser-chrome meta " +
				`colours belong in head.astro:\n${violations.join("\n")}`,
		).toEqual([]);
		expect(
			Object.fromEntries(
				Object.keys(COLOUR_BASELINE).map((path) => [
					path,
					counts.get(path) ?? 0,
				]),
			),
			"A file's raw colour count changed. A new literal must use a " +
				"token instead; after removing one, lower its COLOUR_BASELINE " +
				"count (delete the entry at zero)",
		).toEqual(
			Object.fromEntries(
				Object.entries(COLOUR_BASELINE).map(([path, { count }]) => [
					path,
					count,
				]),
			),
		);
		expect(
			Object.entries(COLOUR_BASELINE)
				.filter(([, { count }]) => count < 1)
				.map(([path]) => path),
			"Baseline entries at zero; delete them",
		).toEqual([]);
	});

	it("gives every literal class name a CSS rule that reaches it", () => {
		const index = classIndex(projectRoot);
		// A scan that finds no rules would pass everything below.
		expect(index.global.size).toBeGreaterThan(500);
		expect(index.global.has("sr-only")).toBe(true);
		// Course demos ship their own CSS to a sandbox; it is not the site's.
		for (const name of ["hidden", "container", "card", "btn-primary"]) {
			expect(index.global.has(name), name).toBe(false);
		}

		const violations: string[] = [];
		const used = new Set<string>();
		let scanned = 0;
		const check = (relPath: string, token: string, line: number) => {
			scanned += 1;
			if (isDefinedClass(index, relPath, token)) return;
			if (
				token in UNSTYLED_CLASS_ALLOWLIST ||
				INHERITED_CLASS_ALLOWLIST[relPath]?.includes(token)
			) {
				used.add(token);
				return;
			}
			violations.push(`${relPath}:${line}: ${token}`);
		};
		for (const file of walkFiles(join(projectRoot, "src"), [
			".astro",
			".vue",
			".tsx",
			".jsx",
			".ts",
		])) {
			const relPath = relative(projectRoot, file);
			if (
				relPath.includes(".stories.") ||
				relPath.startsWith("src/tests/") ||
				relPath.endsWith(".d.ts")
			) {
				continue;
			}
			const source = readFileSync(file, "utf-8");
			const markup = /\.(?:astro|vue|tsx|jsx)$/.test(relPath);
			if (markup) {
				for (const { token, line } of staticClassTokens(source)) {
					check(relPath, token, line);
				}
			}
			// HTML assembled as a string carries no scope: only a global rule
			// reaches it, so it is checked against a path that has no scoped
			// styles.
			const code = /\.(?:astro|vue)$/.test(relPath)
				? codeRegions(source)
				: markup
					? ""
					: source;
			for (const { token, line } of htmlStringClassTokens(code)) {
				check("", token, line);
				if (violations.at(-1) === `:${line}: ${token}`) {
					violations[violations.length - 1] =
						`${relPath}:${line}: ${token} (HTML built in code needs a global rule)`;
				}
			}
		}

		expect(scanned).toBeGreaterThan(500);
		expect(
			violations,
			"Class names with no CSS rule that reaches them. A scoped style " +
				"only applies inside its own file. Style the element through a " +
				"design-system recipe slot or the component <style>, or delete " +
				`the dead name:\n${violations.join("\n")}`,
		).toEqual([]);
		const allowlisted = [
			...Object.keys(UNSTYLED_CLASS_ALLOWLIST),
			...Object.values(INHERITED_CLASS_ALLOWLIST).flat(),
		];
		expect(
			allowlisted.filter((name) => !used.has(name)),
			"Allowlisted class names that are no longer used; delete the entry",
		).toEqual([]);
	});

	it("reads class names precisely", () => {
		const names = (source: string) =>
			staticClassTokens(source).map(({ token }) => token);
		expect(
			names('<a class="card card--wide md:hover:p-[3px]" href="#x">'),
		).toEqual(["card", "card--wide", "md:hover:p-[3px]"]);
		// A call argument is a variant value, not a class.
		expect(
			names('<Button variant="outline" class={button("outline")} />'),
		).toEqual([]);
		expect(
			names('<a class={button({ variant: "outline", size: "sm" })} />'),
		).toEqual([]);
		// A bare word in an array, a ternary or an `&&` is a class.
		expect(
			names('<div class:list={[s.root, "is-open", open && "hidden"]} />'),
		).toEqual(["is-open", "hidden"]);
		expect(names('<i className={on ? "flex" : "grid"} />')).toEqual([
			"flex",
			"grid",
		]);
		expect(
			names('<i class:list={[kind === "video" ? s.a : "b", s["c"]]} />'),
		).toEqual(["b"]);
		expect(names("<i class={`a ${b}`} />")).toEqual([]);
		expect(names('<i class={cn("flex", s.root)} />')).toEqual(["flex"]);
		// Object keys and shorthands are class names; spreads are not.
		expect(
			names(`<p :class="{ 'is-active': on, flex: on, quiet, ...rest }" />`),
		).toEqual(["is-active", "flex", "quiet"]);
		expect(
			names(`<p :class="[styles.row, { 'has-media': item.media }]" />`),
		).toEqual(["has-media"]);
		expect(
			expressionClassNames('[s.x, { a: 1, "b c": 2 }, fn({ d: 1 })]'),
		).toEqual(["a", "b", "c"]);
		expect(
			names("---\nconst html = '<i class=\"ghost\">';\n---\n<p />"),
		).toEqual([]);
		expect(names('<style>.a { color: red }</style><b class="a" />')).toEqual([
			"a",
		]);
	});

	it("knows how far a style block reaches", () => {
		expect(
			styleBlockClasses(
				"<style>.a :global(.b) .c {}</style><style is:global>.d {}</style>",
				"astro",
			),
		).toEqual({ global: ["b", "d"], local: ["a", "b", "c"] });
		expect(
			styleBlockClasses(
				"<style scoped>.a :deep(.b) {}</style><style>.c {}</style>",
				"vue",
			),
		).toEqual({ global: ["b", "c"], local: ["a", "b"] });
		// Frontmatter and scripts are scanned for HTML built as a string.
		const code = codeRegions(
			'---\nconst html = \'<i class="ghost">\';\n---\n<p class="real" />',
		);
		expect(htmlStringClassTokens(code).map(({ token }) => token)).toEqual([
			"ghost",
		]);
	});
});
