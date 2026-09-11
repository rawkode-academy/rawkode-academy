import {
	defineConfig,
	presetWind3,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

/**
 * UnoCSS config — Ops Console × Catppuccin Mocha foundation.
 *
 * Token *values* for dark/preview live as `--ctp-mocha-*` in global.css.
 * Semantic shortcuts still bind to `--editorial-*` / `--surface-*`, which
 * remap to Mocha under `html.dark`.
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
		// Raw Tailwind gray utilities are banned: they drift from the Mocha
		// console palette. Use semantic tokens instead — text-primary-content /
		// text-secondary-content / text-muted, bg-[var(--surface-*)],
		// bg-[var(--ctp-mocha-*)], border-[var(--surface-border)].
		// src/tests/design-tokens.test.ts fails CI with the offending files.
		[
			/(?:^|:)(?:bg|text|border|divide|ring|outline|decoration|from|to|via|fill|stroke|placeholder|caret|accent|shadow)-gray-\d+(?:\/\d+)?$/,
			{
				message:
					"gray-* utilities are banned — use Mocha / semantic tokens (text-*-content, var(--ctp-mocha-*), var(--surface-*))",
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
			// Catppuccin Mocha — prefer these for new chrome utilities.
			"mocha-crust": "var(--ctp-mocha-crust)",
			"mocha-mantle": "var(--ctp-mocha-mantle)",
			"mocha-base": "var(--ctp-mocha-base)",
			"mocha-surface0": "var(--ctp-mocha-surface0)",
			"mocha-surface1": "var(--ctp-mocha-surface1)",
			"mocha-surface2": "var(--ctp-mocha-surface2)",
			"mocha-overlay0": "var(--ctp-mocha-overlay0)",
			"mocha-overlay1": "var(--ctp-mocha-overlay1)",
			"mocha-overlay2": "var(--ctp-mocha-overlay2)",
			"mocha-subtext0": "var(--ctp-mocha-subtext0)",
			"mocha-subtext1": "var(--ctp-mocha-subtext1)",
			"mocha-text": "var(--ctp-mocha-text)",
			"mocha-lavender": "var(--ctp-mocha-lavender)",
			"mocha-blue": "var(--ctp-mocha-blue)",
			"mocha-sapphire": "var(--ctp-mocha-sapphire)",
			"mocha-teal": "var(--ctp-mocha-teal)",
			"mocha-green": "var(--ctp-mocha-green)",
			"mocha-yellow": "var(--ctp-mocha-yellow)",
			"mocha-peach": "var(--ctp-mocha-peach)",
			"mocha-red": "var(--ctp-mocha-red)",
			"mocha-mauve": "var(--ctp-mocha-mauve)",
		},
		fontFamily: {
			// Ops Console: grotesque + mono only on chrome. Display/serif
			// remain for content surfaces outside this PR's chrome scope.
			display:
				"var(--font-instrument-serif), 'Iowan Old Style', Georgia, serif",
			body: "var(--font-inter-tight), 'Inter', -apple-system, system-ui, sans-serif",
			mono: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
			serif: "var(--font-instrument-serif), 'Iowan Old Style', Georgia, serif",
			sans: "var(--font-inter-tight), 'Inter', -apple-system, system-ui, sans-serif",
		},
		borderRadius: {
			// Ops Console — 0–2px. Names preserved for back-compat.
			xs: "0",
			sm: "2px",
			md: "2px",
			lg: "2px",
			xl: "2px",
			"2xl": "2px",
			"3xl": "2px",
			"4xl": "2px",
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
		// Text-tone utilities — bind to semantic vars (Mocha under html.dark).
		"text-primary-content": "text-[var(--text-primary-content)]",
		"text-secondary-content": "text-[var(--text-secondary-content)]",
		"text-muted": "text-[var(--text-muted)]",
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
		// Shadow utilities — bound to the `--shadow-*` hairline ramp.
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
			// Focus ring — lavender 2px (Ops Console).
			getCSS: () => `
.focus-ring:focus-visible {
	outline: 2px solid var(--ctp-mocha-lavender);
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
