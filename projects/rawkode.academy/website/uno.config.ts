import {
	defineConfig,
	presetWind3,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

/**
 * UnoCSS config — Phase 0 (visually-neutral migration from Tailwind v4).
 *
 * This file is the new home of every `@theme` block and `@utility` directive
 * that previously lived in `src/styles/global.css`. The legacy file keeps the
 * `:root` / `html.dark` CSS-variable declarations and the `@layer base/components`
 * styles, since those are framework-agnostic plain CSS that UnoCSS happily
 * leaves alone.
 *
 * Token *values* are preserved exactly — this is a mechanical engine swap, not
 * a rebrand. The rebrand happens in Phase 1.
 */
export default defineConfig({
	presets: [presetWind3()],
	transformers: [transformerDirectives(), transformerVariantGroup()],
	// Astro's `class:list` directive looks superficially like an attributify
	// pattern and otherwise leaks broken CSS rules into the generated bundle.
	// Block the literal attribute names so the content scanner skips them.
	blocklist: [
		"class:list",
		"set:html",
		"set:text",
		"client:load",
		"client:idle",
		"client:visible",
		"client:only",
		"client:media",
		// Raw Tailwind gray utilities are banned: they drift from the warm
		// paper/ink editorial palette (worst in dark mode, where gray-900's
		// cool hue clashes with the ink-dark ground). Use the semantic
		// tokens instead — text-primary-content / text-secondary-content /
		// text-muted, bg-[var(--surface-*)], border-[var(--surface-border)].
		// src/tests/design-tokens.test.ts fails CI with the offending files.
		[
			/(?:^|:)(?:bg|text|border|divide|ring|outline|decoration|from|to|via|fill|stroke|placeholder|caret|accent|shadow)-gray-\d+(?:\/\d+)?$/,
			{
				message:
					"gray-* utilities are banned — use the editorial tokens (text-*-content, var(--surface-*))",
			},
		],
	],
	theme: {
		colors: {
			primary: "rgb(var(--brand-primary) / <alpha-value>)",
			secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
			accent: "rgb(var(--brand-accent) / <alpha-value>)",
			"brand-primary": "rgb(var(--brand-primary) / <alpha-value>)",
			"brand-secondary": "rgb(var(--brand-secondary) / <alpha-value>)",
		},
		fontFamily: {
			// Editorial trio. Display = serif (italic-by-default headings).
			// Body = neo-grotesque. Mono = code/metadata.
			display:
				"var(--font-instrument-serif), 'Iowan Old Style', Georgia, serif",
			body: "var(--font-inter-tight), 'Inter', -apple-system, system-ui, sans-serif",
			mono: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
			serif: "var(--font-instrument-serif), 'Iowan Old Style', Georgia, serif",
			sans: "var(--font-inter-tight), 'Inter', -apple-system, system-ui, sans-serif",
		},
		borderRadius: {
			// Editorial radii — sharp 2px corners. Names preserved for back-compat.
			xs: "2px",
			sm: "2px",
			md: "3px",
			lg: "3px",
			xl: "4px",
			"2xl": "4px",
			"3xl": "6px",
			"4xl": "8px",
		},
		duration: {
			fast: "120ms",
			base: "200ms",
			slow: "300ms",
			slower: "500ms",
		},
		easing: {
			standard: "cubic-bezier(0.4, 0, 0.2, 1)",
			out: "cubic-bezier(0, 0, 0.2, 1)",
			in: "cubic-bezier(0.4, 0, 1, 1)",
			spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
		},
		spacing: {
			"page-sm": "var(--space-page-sm)",
			page: "var(--space-page)",
			"page-lg": "var(--space-page-lg)",
			"section-tight": "var(--space-section-tight)",
			section: "var(--space-section)",
			"section-relaxed": "var(--space-section-relaxed)",
			"stack-sm": "var(--space-stack-sm)",
			stack: "var(--space-stack)",
			"stack-lg": "var(--space-stack-lg)",
			card: "var(--space-card-pad)",
			"card-lg": "var(--space-card-pad-lg)",
		},
		boxShadow: {
			sm: "var(--shadow-sm)",
			md: "var(--shadow-md)",
			lg: "var(--shadow-lg)",
			xl: "var(--shadow-xl)",
		},
	},
	shortcuts: {
		// Text-tone utilities — back the `text-*-content` classes with the
		// editorial CSS variables so light/dark swap follows --editorial-ink/-soft/-mute.
		"text-primary-content": "text-[var(--editorial-ink)]",
		"text-secondary-content": "text-[var(--editorial-ink-soft)]",
		"text-muted": "text-[var(--editorial-ink-mute)]",
	},
	rules: [
		// Motion utilities — `@apply transition-*` from scoped style blocks.
		[
			"transition-fast",
			{ transition: "all var(--duration-fast) var(--ease-standard)" },
		],
		[
			"transition-smooth",
			{ transition: "all var(--duration-base) var(--ease-standard)" },
		],
		[
			"transition-card",
			{ transition: "all var(--duration-slow) var(--ease-standard)" },
		],
		[
			"transition-spring",
			{ transition: "all var(--duration-slow) var(--ease-spring)" },
		],
		[
			"transition-colors-smooth",
			{
				"transition-property":
					"color, background-color, border-color, fill, stroke",
				"transition-duration": "var(--duration-base)",
				"transition-timing-function": "var(--ease-standard)",
			},
		],
		[
			"transition-colors-card",
			{
				"transition-property":
					"color, background-color, border-color, fill, stroke",
				"transition-duration": "var(--duration-slow)",
				"transition-timing-function": "var(--ease-standard)",
			},
		],
		// Shadow utilities — bound to the `--shadow-*` ramp.
		["card-shadow-sm", { "box-shadow": "var(--shadow-sm)" }],
		["card-shadow", { "box-shadow": "var(--shadow-md)" }],
		["card-shadow-md", { "box-shadow": "var(--shadow-md)" }],
		["card-shadow-lg", { "box-shadow": "var(--shadow-lg)" }],
		["card-shadow-elevated", { "box-shadow": "var(--shadow-lg)" }],
		["card-shadow-xl", { "box-shadow": "var(--shadow-xl)" }],
		// Surface borders.
		["border-surface", { "border-color": "var(--surface-border)" }],
		[
			"border-surface-strong",
			{ "border-color": "var(--surface-border-strong)" },
		],
	],
	preflights: [
		{
			// `focus-ring` wraps a pseudo-selector that UnoCSS rules can't
			// express in a single declaration. Emitting it as preflight CSS
			// preserves the exact existing semantics (only render on
			// `:focus-visible`).
			getCSS: () => `
.focus-ring:focus-visible {
	outline: 2px solid rgb(var(--brand-primary));
	outline-offset: 2px;
	border-radius: var(--radius-sm);
}
`,
		},
	],
	// Match the same content set Tailwind v4 was picking up via Vite plugin.
	content: {
		filesystem: [
			"src/**/*.{astro,vue,ts,tsx,js,jsx,md,mdx}",
			".storybook/**/*.{ts,tsx}",
		],
	},
});
