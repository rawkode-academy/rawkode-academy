import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	// The website owns the small application reset in global.css. Keep reset
	// ownership outside this package so recipes remain composable.
	preflight: false,
	presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
	strictTokens: true,
	include: ["./src/**/*.{ts,vue}"],
	outdir: "./styled-system",
	conditions: {
		extend: {
			sm: "@media (min-width: 640px)",
			lg: "@media (min-width: 1024px)",
			motionReduce: "@media (prefers-reduced-motion: reduce)",
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
					academyBase: {
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
							'var(--font-red-hat-display, "Red Hat Display"), "Helvetica Neue", Arial, sans-serif',
					},
					"academy-text": {
						value:
							'var(--font-red-hat-text, "Red Hat Text"), "Helvetica Neue", Arial, sans-serif',
					},
					"academy-mono": {
						value:
							'var(--font-red-hat-mono, "Red Hat Mono"), ui-monospace, "SFMono-Regular", Menlo, monospace',
					},
				},
				radii: {
					xs: { value: "2px" },
					sm: { value: "2px" },
					md: { value: "3px" },
					"academy-s": { value: "3px" },
					"academy-m": { value: "4px" },
					"academy-l": { value: "6px" },
					"academy-pill": { value: "999px" },
				},
				borders: {
					hairline: { value: "1px solid {colors.academy.border}" },
					focus: { value: "2px solid" },
					"academy-button": { value: "1px solid transparent" },
					"academy-tab": { value: "2px solid" },
				},
				spacing: {
					focus: { value: "2px" },
					"focus-inset": { value: "-2px" },
					"academy-gutter": { value: "clamp(20px, 4vw, 48px)" },
					"academy-gutter-wide": { value: "48px" },
					"academy-section": { value: "64px" },
					"academy-section-wide": { value: "88px" },
					"academy-join": { value: "72px" },
					"academy-hero": { value: "clamp(3rem, 7vw, 6rem)" },
					"academy-hero-tight": { value: "clamp(2rem, 4vw, 3.5rem)" },
				},
				sizes: {
					"academy-lede": { value: "42ch" },
					"academy-shell": { value: "1180px" },
					"academy-content": { value: "1084px" },
					"academy-reading-shell": { value: "776px" },
					"academy-toc": { value: "calc(100dvh - 4rem)" },
					"academy-command": { value: "85dvh" },
					"academy-command-list": { value: "50dvh" },
					"academy-diagram-viewport": { value: "70svh" },
					"academy-copy": { value: "680px" },
					"academy-transcript": { value: "600px" },
					"academy-card": { value: "400px" },
					"academy-card-mobile": { value: "74vw" },
					"academy-feature": { value: "42%" },
					"academy-play": { value: "72px" },
					"academy-hero-copy": { value: "36rem" },
					"academy-ledger-date": { value: "6.5rem" },
					"academy-path-index": { value: "8rem" },
				},
				aspectRatios: {
					"academy-video": { value: "16 / 9" },
				},
				fontSizes: {
					"academy-display": { value: "clamp(3rem, 6.4vw, 5.5rem)" },
					// Poster scale: the homepage statement and collection mastheads.
					// The type is the composition, so it runs to the shell edge.
					"academy-poster": { value: "clamp(3.5rem, 11.5vw, 10rem)" },
					"academy-masthead": { value: "clamp(2.75rem, 9vw, 7.5rem)" },
					"academy-numeral": { value: "clamp(2.25rem, 4.5vw, 3.75rem)" },
					"academy-statement": { value: "clamp(2rem, 5.5vw, 4.5rem)" },
					"academy-ledger-day": { value: "clamp(1.75rem, 2.4vw, 2.25rem)" },
					"academy-lede": { value: "clamp(1.125rem, 1.4vw, 1.375rem)" },
					"academy-title": { value: "clamp(2.4rem, 5vw, 4rem)" },
					"academy-section": { value: "clamp(2.25rem, 4vw, 3.5rem)" },
					"academy-caption": { value: "0.6875rem" },
				},
				letterSpacings: {
					"academy-display": { value: "-0.035em" },
					"academy-poster": { value: "-0.05em" },
					"academy-tight": { value: "-0.02em" },
				},
				lineHeights: {
					"academy-display": { value: "1.04" },
					"academy-poster": { value: "0.9" },
					"academy-title": { value: "1.15" },
					"academy-card": { value: "1.3" },
					"academy-reading": { value: "1.65" },
					dialog: { value: "1.1" },
					body: { value: "1.5" },
				},
				shadows: {
					dialog: { value: "0 24px 80px oklch(0 0 0 / 0.2)" },
				},
				durations: {
					none: { value: "0s" },
					fast: { value: "120ms" },
					base: { value: "200ms" },
					slow: { value: "320ms" },
					reveal: { value: "720ms" },
					"stagger-1": { value: "60ms" },
					"stagger-2": { value: "140ms" },
					"stagger-3": { value: "220ms" },
					"stagger-4": { value: "320ms" },
				},
				easings: {
					"academy-out": { value: "cubic-bezier(0.22, 1, 0.36, 1)" },
					"academy-standard": { value: "cubic-bezier(0.4, 0, 0.2, 1)" },
				},
				animations: {
					none: { value: "none" },
					"academy-skeleton": {
						value: "academy-skeleton-pulse 1.8s ease-in-out infinite",
					},
					"academy-live": {
						value: "academy-live-pulse 1.8s ease-in-out infinite",
					},
					"academy-spinner": { value: "academy-spinner 1s linear infinite" },
					"academy-rise": {
						value: "academy-rise 720ms cubic-bezier(0.22, 1, 0.36, 1) both",
					},
					"academy-fade": {
						value: "academy-fade 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
					},
					"academy-slide-in": {
						value: "academy-slide-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
					},
					// Scroll-driven: paired with animation-timeline: view() so rows
					// rise as they enter the viewport. Browsers without scroll
					// timelines never apply it (see the @supports guards).
					"academy-reveal": { value: "academy-reveal linear both" },
				},
				zIndex: {
					overlay: { value: 1000 },
				},
			},
			keyframes: {
				"academy-skeleton-pulse": {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.55" },
				},
				"academy-live-pulse": {
					"0%, 100%": { opacity: "1", transform: "scale(1)" },
					"50%": { opacity: "0.7", transform: "scale(0.92)" },
				},
				"academy-spinner": {
					to: { transform: "rotate(360deg)" },
				},
				"academy-rise": {
					from: { opacity: "0", transform: "translateY(0.75rem)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				"academy-fade": {
					from: { opacity: "0" },
					to: { opacity: "1" },
				},
				"academy-slide-in": {
					from: { transform: "translateX(2rem)", opacity: "0" },
					to: { transform: "translateX(0)", opacity: "1" },
				},
				"academy-reveal": {
					from: { opacity: "0", transform: "translateY(1.5rem)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
			},
			semanticTokens: {
				colors: {
					academy: {
						canvas: {
							value: {
								base: "#f4f7fb",
								_dark: "{colors.academyBase.ground}",
							},
						},
						ground: {
							value: {
								base: "#eaf0f8",
								_dark: "{colors.academyBase.ground-raised}",
							},
						},
						grid: {
							value: {
								base: "#dbe4f0",
								_dark: "{colors.academyBase.grid-line}",
							},
						},
						panel: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academyBase.panel}",
							},
						},
						border: {
							value: {
								base: "#cfdae8",
								_dark: "{colors.academyBase.border}",
							},
						},
						text: {
							value: {
								base: "#0c1626",
								_dark: "{colors.academyBase.text}",
							},
						},
						textSoft: {
							value: {
								base: "#33425a",
								_dark: "{colors.academyBase.text-soft}",
							},
						},
						textMuted: {
							value: {
								base: "#526178",
								_dark: "{colors.academyBase.text-muted}",
							},
						},
						accent: {
							value: {
								base: "#c2185b",
								_dark: "{colors.academyBase.accent}",
							},
						},
						accentForeground: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academyBase.accent-foreground}",
							},
						},
						statusSky: { value: { base: "#0369a1", _dark: "#7dd3fc" } },
						statusViolet: { value: { base: "#6d28d9", _dark: "#c4b5fd" } },
						statusAmber: {
							value: {
								base: "#9a5800",
								_dark: "#f2b53d",
							},
						},
						statusRust: {
							value: {
								base: "#b23b26",
								_dark: "#ef8f78",
							},
						},
						statusSpruce: {
							value: {
								base: "#16785d",
								_dark: "#6ed2ac",
							},
						},
						input: {
							value: {
								base: "#ffffff",
								_dark: "{colors.academyBase.input}",
							},
						},
						inputBorder: {
							value: {
								base: "#6d7c93",
								_dark: "{colors.academyBase.input-border}",
							},
						},
						segmentOff: {
							value: {
								base: "#c3d0e2",
								_dark: "{colors.academyBase.segment-off}",
							},
						},
						// Ink surfaces: the navy that carries the homepage hero and
						// the footer in light mode. In dark mode the canvas is already
						// navy, so ink becomes a raised, bordered panel instead.
						ink: {
							value: {
								base: "#0c1626",
								_dark: "{colors.academyBase.ground-raised}",
							},
						},
						inkRaised: {
							value: {
								base: "#152238",
								_dark: "{colors.academyBase.panel}",
							},
						},
						inkBorder: {
							value: {
								base: "oklch(1 0 0 / 0.14)",
								_dark: "{colors.academyBase.border}",
							},
						},
						inkText: {
							value: {
								base: "#f4f7fb",
								_dark: "{colors.academyBase.text}",
							},
						},
						inkTextSoft: {
							value: {
								base: "#c5d0e0",
								_dark: "{colors.academyBase.text-soft}",
							},
						},
						inkTextMuted: {
							value: {
								base: "#8fa0b8",
								_dark: "{colors.academyBase.text-muted}",
							},
						},
						inkAccent: {
							value: {
								base: "{colors.academyBase.accent}",
								_dark: "{colors.academyBase.accent}",
							},
						},
						inkAccentForeground: {
							value: {
								base: "{colors.academyBase.accent-foreground}",
								_dark: "{colors.academyBase.accent-foreground}",
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
