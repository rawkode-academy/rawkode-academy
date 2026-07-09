import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-system guard: raw Tailwind gray-* utilities are banned in favour
 * of the editorial tokens (text-primary-content / text-secondary-content /
 * text-muted, bg-[var(--surface-*)], border-[var(--surface-border)], the
 * --terminal-* chrome tokens, …). Grays are cool-hued and drift from the
 * warm paper/ink palette — worst in dark mode, where gray-900 clashes with
 * the ink-dark ground. The UnoCSS blocklist in uno.config.ts stops the CSS
 * from being generated; this test points CI at the offending files.
 */

const SCAN_ROOTS = ["src", ".storybook"];
const SCAN_EXTENSIONS = [".astro", ".vue", ".tsx", ".jsx", ".ts", ".js", ".mdx"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", "generated"]);
const SKIP_FILES = new Set(["src/tests/design-tokens.test.ts"]);

const BANNED_PATTERN =
	/(?:bg|text|border|divide|ring|outline|decoration|from|to|via|fill|stroke|placeholder|caret|accent|shadow)-gray-\d+(?:\/\d+)?/g;

// Vitest runs with cwd at the website project root; import.meta.url is not
// usable here because Vite serves transformed modules behind an /@fs prefix.
const projectRoot = process.cwd();

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
	it("defines the technical-publication layout contracts", () => {
		const globalCss = readFileSync(join(projectRoot, "src/styles/global.css"), "utf-8");
		const appLayout = readFileSync(join(projectRoot, "src/layouts/app.astro"), "utf-8");

		for (const token of [
			"--layout-prose",
			"--layout-content",
			"--layout-wide",
			"--space-page-pad-inline",
			"--type-page-title",
		]) {
			expect(globalCss, `Missing publication token ${token}`).toContain(token);
		}

		expect(appLayout).toContain("PublicationNav");
		expect(appLayout).not.toContain('components/sidebar/Sidebar.astro');
	});

	it("keeps the applied color scheme authoritative", () => {
		const globalCss = readFileSync(join(projectRoot, "src/styles/global.css"), "utf-8");
		const pageWrapper = readFileSync(join(projectRoot, "src/wrappers/page.astro"), "utf-8");
		const publicationNav = readFileSync(
			join(projectRoot, "src/components/navigation/PublicationNav.astro"),
			"utf-8",
		);

		expect(globalCss).toMatch(/:root\s*\{[\s\S]*?color-scheme:\s*light;/);
		expect(globalCss).toMatch(/html\.dark\s*\{[\s\S]*?color-scheme:\s*dark;/);
		expect(pageWrapper).not.toContain("color-scheme: light dark");
		expect(publicationNav).toContain("background: var(--terminal-bg)");
		expect(publicationNav).toContain("color: var(--terminal-text)");
	});

	it("uses editorial tokens instead of raw gray-* utilities", () => {
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
			`Raw gray-* utilities found. Replace them with editorial tokens ` +
				`(text-primary-content / text-secondary-content / text-muted, ` +
				`bg-[var(--surface-*)], border-[var(--surface-border)]):\n` +
				violations.join("\n"),
		).toEqual([]);
	});
});
