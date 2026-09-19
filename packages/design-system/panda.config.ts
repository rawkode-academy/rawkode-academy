import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	// The website currently has an UnoCSS preflight. Keep reset ownership
	// outside this package until the application migration is deliberate.
	preflight: false,
	presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
	strictTokens: true,
	include: ["./src/**/*.{ts,vue}"],
	outdir: "./styled-system",
	conditions: {
		extend: {
			lg: "@media (min-width: 1024px)",
		},
	},
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
					academy: {
						ground: { value: "#0a1220" },
						"ground-raised": { value: "#0d1728" },
						"grid-line": { value: "#142136" },
						panel: { value: "#111d31" },
						border: { value: "#22324d" },
						text: { value: "#e8eef8" },
						"text-soft": { value: "#bfcbdd" },
						"text-muted": { value: "#8fa0b8" },
						accent: { value: "#ff7ab6" },
						"accent-foreground": { value: "#2a0616" },
						input: { value: "#0a1220" },
						"input-border": { value: "#64768f" },
						"segment-off": { value: "#2f4262" },
					},
				},
				fonts: {
					"academy-display": {
						value:
							'"Red Hat Display", "Helvetica Neue", Arial, sans-serif',
					},
					"academy-text": {
						value: '"Red Hat Text", "Helvetica Neue", Arial, sans-serif',
					},
					"academy-mono": {
						value:
							'"Red Hat Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
					},
				},
				radii: {
					xs: { value: "2px" },
					sm: { value: "2px" },
					md: { value: "3px" },
					"academy-s": { value: "6px" },
					"academy-m": { value: "8px" },
					"academy-l": { value: "12px" },
					"academy-pill": { value: "999px" },
				},
				borders: {
					hairline: { value: "1px solid" },
					focus: { value: "2px solid" },
					"academy-button": { value: "1px solid transparent" },
					"academy-tab": { value: "2px solid" },
				},
				spacing: {
					focus: { value: "2px" },
					"academy-gutter": { value: "24px" },
					"academy-gutter-wide": { value: "96px" },
					"academy-section": { value: "64px" },
					"academy-section-wide": { value: "112px" },
				},
				sizes: {
					"academy-shell": { value: "1180px" },
					"academy-copy": { value: "680px" },
					"academy-card": { value: "400px" },
					"academy-card-mobile": { value: "74vw" },
					"academy-play": { value: "72px" },
				},
				aspectRatios: {
					"academy-video": { value: "16 / 9" },
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
					academy: {
						canvas: {
							value: {
								base: "#f4f7fb",
								_dark: "{colors.academy.ground}",
							},
						},
						ground: {
							value: {
								base: "#eaf0f8",
								_dark: "{colors.academy.ground-raised}",
							},
						},
						grid: {
							value: {
								base: "#dbe4f0",
								_dark: "{colors.academy.grid-line}",
							},
						},
						panel: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academy.panel}",
							},
						},
						border: {
							value: {
								base: "#cfdae8",
								_dark: "{colors.academy.border}",
							},
						},
						text: {
							value: {
								base: "#0c1626",
								_dark: "{colors.academy.text}",
							},
						},
						textSoft: {
							value: {
								base: "#33425a",
								_dark: "{colors.academy.text-soft}",
							},
						},
						textMuted: {
							value: {
								base: "#526178",
								_dark: "{colors.academy.text-muted}",
							},
						},
						accent: {
							value: {
								base: "#c2185b",
								_dark: "{colors.academy.accent}",
							},
						},
						accentForeground: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academy.accent-foreground}",
							},
						},
						input: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academy.input}",
							},
						},
						inputBorder: {
							value: {
								base: "#6d7c93",
								_dark: "{colors.academy.input-border}",
							},
						},
						segmentOff: {
							value: {
								base: "#c3d0e2",
								_dark: "{colors.academy.segment-off}",
							},
						},
					},
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
