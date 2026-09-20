import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	// The website currently has an UnoCSS preflight. Keep reset ownership
	// outside this package until the application migration is deliberate.
	preflight: false,
	presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
	strictTokens: true,
	include: ["./src/**/*.{ts,vue}"],
	outdir: "./styled-system",
	theme: {
		extend: {
			tokens: {
				colors: {
					editorial: {
						paper: { value: "oklch(0.97 0.008 85)" },
						"paper-deep": { value: "oklch(0.93 0.012 85)" },
						ink: { value: "oklch(0.18 0.02 60)" },
						"ink-soft": { value: "oklch(0.36 0.015 60)" },
						"ink-mute": { value: "oklch(0.58 0.012 60)" },
						hairline: { value: "oklch(0.18 0.02 60 / 0.12)" },
						spruce: { value: "oklch(0.52 0.09 165)" },
						overlay: { value: "oklch(0 0 0 / 0.55)" },
					},
				},
				radii: {
					xs: { value: "2px" },
					sm: { value: "2px" },
					md: { value: "3px" },
				},
				borders: {
					hairline: { value: "1px solid" },
					focus: { value: "2px solid" },
				},
				spacing: {
					focus: { value: "2px" },
				},
				lineHeights: {
					dialog: { value: "1.1" },
					body: { value: "1.5" },
				},
				shadows: {
					dialog: { value: "0 24px 80px oklch(0 0 0 / 0.2)" },
				},
				durations: {
					fast: { value: "120ms" },
				},
				zIndex: {
					overlay: { value: 1000 },
				},
			},
			semanticTokens: {
				colors: {
					surface: {
						canvas: {
							value: {
								base: "{colors.editorial.paper}",
								_dark: "oklch(0.14 0.01 280)",
							},
						},
						panel: {
							value: {
								base: "{colors.editorial.paper-deep}",
								_dark: "oklch(0.26 0.014 280)",
							},
						},
					},
					content: {
						primary: {
							value: {
								base: "{colors.editorial.ink}",
								_dark: "oklch(0.93 0.008 85)",
							},
						},
						muted: {
							value: {
								base: "{colors.editorial.ink-soft}",
								_dark: "oklch(0.72 0.012 280)",
							},
						},
					},
					border: {
						default: {
							value: {
								base: "{colors.editorial.hairline}",
								_dark: "oklch(1 0 0 / 0.16)",
							},
						},
					},
					action: {
						primary: {
							value: {
								base: "{colors.editorial.ink}",
								_dark: "{colors.editorial.paper}",
							},
						},
						interactive: {
							value: {
								base: "{colors.editorial.spruce}",
								_dark: "oklch(0.72 0.16 165)",
							},
						},
						primaryForeground: {
							value: {
								base: "{colors.editorial.paper}",
								_dark: "{colors.editorial.ink}",
							},
						},
					},
				},
			},
		},
	},
});
