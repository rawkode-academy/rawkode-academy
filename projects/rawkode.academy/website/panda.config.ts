import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import violet from "@park-ui/panda-preset/colors/violet";
import neutral from "@park-ui/panda-preset/colors/neutral";

export default defineConfig({
	// Inject base styles into the cascade.
	preflight: true,

	// Strict design tokens — fail on unknown tokens.
	strictTokens: false,

	// Use !important for utilities when conflicting with other styles.
	important: false,

	// Where to look for class usages in source files.
	include: [
		"./src/**/*.{ts,tsx,js,jsx,vue,astro,mdx}",
	],

	// Skip generated files.
	exclude: [],

	// Presets — Park UI ships its design system on top of Panda.
	// Park UI maps `accentColor` to its primary brand surface. We use violet
	// (closest to Rawkode's #5F5ED7) and override the brand colours below.
	presets: [
		createPreset({
			accentColor: violet,
			grayColor: neutral,
			radius: "md",
		}),
	],

	theme: {
		extend: {
			tokens: {
				colors: {
					// Brand palette — Rawkode purple/cyan.
					brand: {
						50: { value: "#f3f3fd" },
						100: { value: "#e6e5fb" },
						200: { value: "#cdccf7" },
						300: { value: "#a8a7ef" },
						400: { value: "#827fe5" },
						500: { value: "#5f5ed7" },
						600: { value: "#4a48c4" },
						700: { value: "#3a39a3" },
						800: { value: "#2f2e83" },
						900: { value: "#1f1e5a" },
						950: { value: "#15144a" },
					},
					cyan: {
						50: { value: "#ecfeff" },
						100: { value: "#cffbff" },
						200: { value: "#a5f5ff" },
						300: { value: "#6eecff" },
						400: { value: "#37dcff" },
						500: { value: "#00ceff" },
						600: { value: "#0099d4" },
						700: { value: "#0079ab" },
						800: { value: "#00658a" },
						900: { value: "#075574" },
						950: { value: "#04374e" },
					},
					ink: {
						50: { value: "#f8fafc" },
						100: { value: "#f1f5f9" },
						200: { value: "#e2e8f0" },
						300: { value: "#cbd5e1" },
						400: { value: "#94a3b8" },
						500: { value: "#64748b" },
						600: { value: "#475569" },
						700: { value: "#334155" },
						800: { value: "#1e293b" },
						900: { value: "#111827" },
						950: { value: "#0b0b0f" },
					},
				},
			},
			semanticTokens: {
				colors: {
					// Foreground (text)
					"fg.primary": {
						value: { base: "{colors.ink.900}", _dark: "{colors.ink.50}" },
					},
					"fg.secondary": {
						value: { base: "{colors.ink.700}", _dark: "{colors.ink.300}" },
					},
					"fg.muted": {
						value: { base: "{colors.ink.600}", _dark: "{colors.ink.400}" },
					},
					"fg.subtle": {
						value: { base: "{colors.ink.500}", _dark: "{colors.ink.500}" },
					},
					"fg.inverted": {
						value: { base: "{colors.ink.50}", _dark: "{colors.ink.900}" },
					},
					"fg.brand": {
						value: { base: "{colors.brand.600}", _dark: "{colors.brand.400}" },
					},
					"fg.on-brand": {
						value: { base: "white", _dark: "white" },
					},

					// Background
					"bg.canvas": {
						value: { base: "#ffffff", _dark: "{colors.ink.950}" },
					},
					"bg.surface": {
						value: { base: "{colors.ink.50}", _dark: "{colors.ink.900}" },
					},
					"bg.raised": {
						value: { base: "#ffffff", _dark: "{colors.ink.800}" },
					},
					"bg.sunken": {
						value: { base: "{colors.ink.100}", _dark: "#08080c" },
					},
					"bg.overlay": {
						value: {
							base: "rgba(255, 255, 255, 0.92)",
							_dark: "rgba(11, 11, 15, 0.92)",
						},
					},
					"bg.brand": {
						value: { base: "{colors.brand.500}", _dark: "{colors.brand.500}" },
					},
					"bg.brand-subtle": {
						value: {
							base: "{colors.brand.50}",
							_dark: "rgba(95, 94, 215, 0.15)",
						},
					},

					// Border
					"border.default": {
						value: {
							base: "rgba(15, 23, 42, 0.1)",
							_dark: "rgba(255, 255, 255, 0.1)",
						},
					},
					"border.muted": {
						value: {
							base: "rgba(15, 23, 42, 0.06)",
							_dark: "rgba(255, 255, 255, 0.06)",
						},
					},
					"border.strong": {
						value: {
							base: "rgba(15, 23, 42, 0.18)",
							_dark: "rgba(255, 255, 255, 0.18)",
						},
					},
					"border.focus": {
						value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" },
					},
				},
				gradients: {
					"brand.primary": {
						value:
							"linear-gradient(135deg, {colors.brand.500} 0%, {colors.cyan.500} 100%)",
					},
					"brand.subtle": {
						value:
							"linear-gradient(135deg, {colors.brand.50} 0%, {colors.cyan.50} 100%)",
					},
				},
				shadows: {
					"sm": {
						value: {
							base: "0 1px 2px rgba(15, 23, 42, 0.06)",
							_dark: "0 1px 2px rgba(0, 0, 0, 0.4)",
						},
					},
					"md": {
						value: {
							base: "0 4px 12px rgba(15, 23, 42, 0.08)",
							_dark: "0 4px 12px rgba(0, 0, 0, 0.5)",
						},
					},
					"lg": {
						value: {
							base: "0 12px 32px rgba(15, 23, 42, 0.12)",
							_dark: "0 12px 32px rgba(0, 0, 0, 0.6)",
						},
					},
					"xl": {
						value: {
							base: "0 24px 64px rgba(15, 23, 42, 0.15)",
							_dark: "0 24px 64px rgba(0, 0, 0, 0.7)",
						},
					},
				},
			},
			fonts: {
				body: {
					value:
						"var(--font-quicksand), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				},
				display: {
					value:
						"var(--font-poppins), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				},
				mono: {
					value:
						"var(--font-monaspace-neon), 'JetBrains Mono', ui-monospace, monospace",
				},
			},
		},
	},

	// Customise the conditions.
	conditions: {
		extend: {
			dark: ".dark &",
			light: ":root:not(.dark) &",
		},
	},

	// Output directory.
	outdir: "styled-system",

	// JSX framework — we're on Vue.
	jsxFramework: "vue",
});
