import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: false,
	include: [
		"./src/components/ui/**/*.{vue,ts}",
	],
	exclude: [],
	jsxFramework: "vue",
	theme: {
		extend: {
			tokens: {
				colors: {
					surface: {
						base: { value: "var(--surface-base)" },
						overlay: { value: "var(--surface-overlay)" },
						card: { value: "var(--surface-card)" },
						cardMuted: { value: "var(--surface-card-muted)" },
					},
					brand: {
						primary: { value: "rgb(var(--brand-primary))" },
						secondary: { value: "rgb(var(--brand-secondary))" },
						accent: { value: "rgb(var(--brand-accent))" },
					},
				},
				borders: {
					surface: { value: "1px solid var(--surface-border)" },
					surfaceStrong: { value: "1px solid var(--surface-border-strong)" },
				},
				shadows: {
					surface: { value: "var(--surface-shadow)" },
					surfaceStrong: { value: "var(--surface-shadow-strong)" },
					card: { value: "0 8px 32px 0 rgba(0, 0, 0, 0.12)" },
					cardElevated: { value: "0 12px 40px 0 rgba(0, 0, 0, 0.18)" },
				},
			},
			semanticTokens: {
				colors: {
					fg: {
						default: {
							value: { base: "{colors.gray.900}", _dark: "white" },
						},
						muted: {
							value: { base: "{colors.gray.700}", _dark: "{colors.gray.300}" },
						},
						subtle: {
							value: { base: "{colors.gray.600}", _dark: "{colors.gray.400}" },
						},
					},
					bg: {
						canvas: {
							value: { base: "white", _dark: "{colors.gray.900}" },
						},
						muted: {
							value: { base: "{colors.gray.50}", _dark: "{colors.gray.800}" },
						},
					},
					border: {
						subtle: {
							value: { base: "rgba(255, 255, 255, 0.4)", _dark: "rgba(75, 85, 99, 0.5)" },
						},
					},
				},
			},
		},
	},
	outdir: "styled-system",
});
