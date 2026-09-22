import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-system guard: raw Tailwind gray-* utilities are banned in favour
 * of Academy semantic tokens and their legacy surface/text aliases. Raw
 * grays bypass the shared light/dark palette. This test points CI at the
 * offending files and protects the public shell's font/branding contracts.
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
	it("composes Academy chrome and retains compatibility layout tokens", () => {
		const globalCss = readFileSync(
			join(projectRoot, "src/styles/global.css"),
			"utf-8",
		);
		const appLayout = readFileSync(
			join(projectRoot, "src/layouts/app.astro"),
			"utf-8",
		);

		for (const token of [
			"--layout-prose",
			"--layout-content",
			"--layout-wide",
			"--space-page-pad-inline",
			"--type-page-title",
		]) {
			expect(
				globalCss,
				`Missing compatibility layout token ${token}`,
			).toContain(token);
		}

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
		for (const [alias, token] of [
			["surface-base", "canvas"],
			["surface-card", "panel"],
			["surface-border", "border"],
			["editorial-ink", "text"],
		]) {
			// Both mode blocks must inherit the palette rather than pinning old colors.
			for (const selector of [
				/:root\s*\{([^}]*color-scheme:\s*light;[^}]*)\}/,
				/html\.dark\s*\{([^}]*color-scheme:\s*dark;[^}]*)\}/,
			]) {
				expect(globalCss.match(selector)?.[1]).toContain(
					`--${alias}: var(--colors-academy-${token});`,
				);
			}
		}
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
			/body\s*\{[^}]*font-family:\s*var\(--font-red-hat-text\)/,
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
			`Raw gray-* utilities found. Replace them with Academy semantic tokens ` +
				`or compatibility aliases (text-primary-content / text-secondary-content / text-muted, ` +
				`bg-[var(--surface-*)], border-[var(--surface-border)]):\n` +
				violations.join("\n"),
		).toEqual([]);
	});
});
