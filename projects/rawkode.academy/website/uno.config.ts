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
	blocklist: ["class:list", "set:html", "set:text", "client:load", "client:idle", "client:visible", "client:only", "client:media"],
	theme: {
		colors: {
			primary: "rgb(var(--brand-primary) / <alpha-value>)",
			secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
			accent: "rgb(var(--brand-accent) / <alpha-value>)",
			"brand-primary": "rgb(var(--brand-primary) / <alpha-value>)",
			"brand-secondary": "rgb(var(--brand-secondary) / <alpha-value>)",
		},
		fontFamily: {
			display: "var(--font-quicksand), sans-serif",
			body: "var(--font-poppins), sans-serif",
			mono: "var(--font-monaspace-neon), monospace",
		},
		borderRadius: {
			xs: "0.375rem",
			sm: "0.5rem",
			md: "0.75rem",
			lg: "1rem",
			xl: "1.2rem",
			"2xl": "1.35rem",
			"3xl": "1.5rem",
			"4xl": "2rem",
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
		// Text-tone utilities — port of the `@utility text-*` blocks.
		// Light values come from gray-900/700/600; dark values from white/gray-300/400.
		"text-primary-content": "text-[rgb(17_24_39)] dark:text-white",
		"text-secondary-content":
			"text-[rgb(55_65_81)] dark:text-[rgb(209_213_219)]",
		"text-muted": "text-[rgb(75_85_99)] dark:text-[rgb(156_163_175)]",
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
			// `focus-ring` and `link-muted` both wrap pseudo-selectors that
			// UnoCSS rules can't express in a single declaration. Emitting
			// them as preflight CSS preserves the exact existing semantics
			// (only render on `:focus-visible`, hover swap to brand colour).
			getCSS: () => `
.focus-ring:focus-visible {
	outline: 2px solid rgb(var(--brand-primary));
	outline-offset: 2px;
	border-radius: var(--radius-sm);
}

.link-muted {
	color: rgb(75 85 99);
	transition-property: color;
	transition-timing-function: var(--ease-standard);
	transition-duration: var(--duration-base);
}

:root.dark .link-muted {
	color: rgb(156 163 175);
}

.link-muted:hover {
	color: rgb(var(--brand-primary));
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
