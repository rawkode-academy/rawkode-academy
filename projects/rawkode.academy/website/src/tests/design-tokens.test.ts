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
