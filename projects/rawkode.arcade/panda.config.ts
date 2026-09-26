import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

/**
 * Rawkode Arcade design tokens.
 *
 * Arcade is not a second brand. Every value below is the Rawkode Academy
 * editorial system's own dark-mode ramp, lifted from
 * `projects/rawkode.academy/website/src/styles/global.css` and its DESIGN.md.
 * The Academy already describes a theme-invariant dark "screen within the page"
 * (`--terminal-*`) and already defines Amber Live as the colour of live /
 * upcoming / attention states. Arcade is that surface at full-page scale,
 * permanently in that state.
 *
 * This file is the ONLY place a raw value may appear. `src/**` writes tokens.
 * `src/tests/design-tokens.test.ts` fails the build on any bypass.
 */

const globalCss = defineGlobalStyles({
	"*, *::before, *::after": {
		boxSizing: "border-box",
	},
	html: {
		colorScheme: "dark",
		minWidth: "320px",
		bg: "ground",
		// Astro's fonts API self-hosts and subsets the Academy trio at build
		// time, so there is no third-party request and no layout shift.
		fontFamily: "body",
		WebkitTextSizeAdjust: "100%",
	},
	body: {
		margin: "0",
		minHeight: "100dvh",
		minWidth: "320px",
		bg: "ground",
		color: "ink",
		textStyle: "body",
		// Numerals in this product change while people watch them. Align by
		// default so a counting score never reflows its own container.
		fontVariantNumeric: "tabular-nums",
	},
	"button, input, select, textarea": {
		font: "inherit",
		color: "inherit",
		letterSpacing: "inherit",
	},
	button: {
		cursor: "pointer",
	},
	"button:disabled": {
		cursor: "not-allowed",
	},
	a: {
		color: "inherit",
		textDecoration: "none",
	},
	"h1, h2, h3": {
		textWrap: "balance",
	},
	p: {
		textWrap: "pretty",
	},
	":focus-visible": {
		outline: "2px solid token(colors.spruce)",
		outlineOffset: "2px",
		borderRadius: "xs",
	},
	// The first implementation shipped this pointed at class names that did
	// not exist. Overriding the generated custom properties reaches every
	// consumer, and the data attributes are emitted by the recipes in
	// src/styles/, so both halves actually land.
	"@media (prefers-contrast: more)": {
		":root": {
			"--colors-rule": "token(colors.ink)",
			"--colors-rule-strong": "token(colors.ink)",
			"--colors-ink-mute": "token(colors.ink)",
			"--colors-ink-soft": "token(colors.ink)",
		},
		"[data-stage], [data-control], [data-field], [data-ruled]": {
			borderWidth: "rule",
		},
	},
	"@media (prefers-reduced-motion: reduce)": {
		"*, *::before, *::after": {
			animationDuration: "1ms !important",
			animationIterationCount: "1 !important",
			transitionDuration: "1ms !important",
			scrollBehavior: "auto !important",
		},
	},
});

export default defineConfig({
	preflight: true,
	presets: ["@pandacss/preset-base"],
	include: ["./src/**/*.{astro,ts,vue}"],
	exclude: ["./src/**/*.test.ts"],
	outdir: "./styled-system",
	jsxFramework: "vue",
	// strictTokens rejects a raw value anywhere a token exists.
	// strictPropertyValues rejects an invalid keyword on properties with a
	// closed value set (display, position, overflow, …).
	strictTokens: true,
	strictPropertyValues: true,
	globalCss,
	// Countdown rings animate a registered angle on the compositor instead of
	// a layout property. @property has to be registered here, not in globalCss.
	globalVars: {
		"--arcade-sweep": {
			syntax: "<angle>",
			inherits: "false",
			initialValue: "0deg",
		},
	},
	conditions: {
		extend: {
			moreContrast: "@media (prefers-contrast: more)",
			reducedMotion: "@media (prefers-reduced-motion: reduce)",
		},
	},
	// Only preset-base is loaded, so preset-panda's default ramp is absent and
	// `tokens` below is the entire scale. There is nothing to drift back into.
	theme: {
		// Only preset-base is loaded, so these are the project's breakpoints.
		breakpoints: {
			sm: "40em",
			md: "48em",
			lg: "64em",
			xl: "80em",
		},
		tokens: {
			colors: {
				// Ground and panels — Academy dark mode, verbatim.
				ground: { value: "oklch(0.14 0.01 280)" },
				surface: { value: "oklch(0.22 0.012 280)" },
				surfaceRaised: { value: "oklch(0.26 0.014 280)" },

				// Ink ramp. Nothing below inkMute exists; CI verifies all three
				// against both ground and surfaceRaised.
				ink: { value: "oklch(0.92 0.008 85)" },
				inkSoft: { value: "oklch(0.74 0.008 85)" },
				inkMute: { value: "oklch(0.66 0.008 85)" },

				// Rules carry the structure. Hairline for direct viewing,
				// strong for anything the stream encoder has to survive.
				rule: { value: "oklch(1 0 0 / 0.10)" },
				ruleStrong: { value: "oklch(1 0 0 / 0.18)" },

				// Four accents. A format is not a state, so formats get none
				// of these — see DESIGN.md, The Format Is Not A State Rule.
				amber: { value: "oklch(0.72 0.15 65)" },
				spruce: { value: "oklch(0.72 0.09 165)" },
				rust: { value: "oklch(0.70 0.12 40)" },
				violet: { value: "oklch(0.70 0.13 290)" },

				// Dim companions for accent-tinted surfaces. Same hue, so a
				// tinted panel never drifts to a neutral grey.
				//
				// 0.10, not the Academy's 0.12: these tints sit on a dark
				// ground, where a bright accent *lifts* the surface instead of
				// darkening it. At 0.14 inkSoft fell to 4.00:1 on spruceDim.
				// 0.10 is the highest value that keeps the whole ink ramp
				// above AA on every tint over both grounds, verified in
				// src/tests/design-tokens.test.ts.
				amberDim: { value: "oklch(0.72 0.15 65 / 0.10)" },
				spruceDim: { value: "oklch(0.72 0.09 165 / 0.10)" },
				rustDim: { value: "oklch(0.70 0.12 40 / 0.10)" },
				violetDim: { value: "oklch(0.70 0.13 290 / 0.10)" },
			},
			fonts: {
				display: {
					value:
						"var(--font-instrument-serif), 'Iowan Old Style', Georgia, serif",
				},
				body: {
					value:
						"var(--font-inter-tight), Inter, -apple-system, system-ui, sans-serif",
				},
				mono: {
					value:
						"var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
				},
			},
			fontSizes: {
				// Seven steps, ≥1.25 ratio between adjacent sans steps.
				// 0.875rem is the prose floor; 0.75rem is metadata only.
				label: { value: "0.75rem" },
				bodySm: { value: "0.875rem" },
				body: { value: "1rem" },
				title: { value: "1.25rem" },
				headline: { value: "clamp(1.75rem, 3.5vw, 3rem)" },
				display: { value: "clamp(2.75rem, 6vw, 5.5rem)" },
				tally: { value: "clamp(2rem, 4vw, 3.25rem)" },
				// Broadcast scale — vmin-based, because the browser is a video
				// source and its root font size is not the viewer's distance.
				castLabel: { value: "2.2vmin" },
				castBody: { value: "3vmin" },
				castTitle: { value: "4.5vmin" },
				castHeadline: { value: "7vmin" },
				castTally: { value: "12vmin" },
				castHero: { value: "16vmin" },
			},
			fontWeights: {
				regular: { value: "400" },
				medium: { value: "500" },
				semibold: { value: "600" },
				bold: { value: "700" },
			},
			lineHeights: {
				flat: { value: "0.95" },
				tight: { value: "1.02" },
				snug: { value: "1.15" },
				normal: { value: "1.55" },
				none: { value: "1" },
			},
			letterSpacings: {
				// Floor is -0.035em. The previous -0.09em collided glyphs.
				display: { value: "-0.035em" },
				headline: { value: "-0.025em" },
				title: { value: "-0.01em" },
				normal: { value: "0" },
				label: { value: "0.12em" },
				code: { value: "0.18em" },
			},
			radii: {
				none: { value: "0" },
				xs: { value: "2px" },
				sm: { value: "3px" },
				md: { value: "4px" },
				lg: { value: "6px" },
				xl: { value: "8px" },
				pill: { value: "999px" },
			},
			borderWidths: {
				hairline: { value: "1px" },
				rule: { value: "2px" },
				heavy: { value: "3px" },
			},
			spacing: {
				// Academy's clamp ramp, plus a fixed micro scale for dense UI.
				"0": { value: "0" },
				"1": { value: "0.25rem" },
				"2": { value: "0.5rem" },
				"3": { value: "0.75rem" },
				"4": { value: "1rem" },
				"5": { value: "1.5rem" },
				"6": { value: "2rem" },
				pageSm: { value: "clamp(1rem, 3vw, 1.75rem)" },
				page: { value: "clamp(1.5rem, 4vw, 3rem)" },
				sectionTight: { value: "clamp(2rem, 5vw, 3.75rem)" },
				section: { value: "clamp(3rem, 6vw, 5rem)" },
				sectionRelaxed: { value: "clamp(4rem, 7vw, 6rem)" },
				stackSm: { value: "clamp(1rem, 3vw, 1.75rem)" },
				stack: { value: "clamp(1.5rem, 3.5vw, 2.5rem)" },
				card: { value: "clamp(1.25rem, 3vw, 2.25rem)" },
				// Broadcast safe areas.
				castSafe: { value: "4vmin" },
				castLower: { value: "14vmin" },
				castRingInset: { value: "1vmin" },
			},
			sizes: {
				// width/height resolve against `sizes`, not `spacing`, so the
				// micro scale is mirrored here rather than written raw.
				"0": { value: "0" },
				"1": { value: "0.25rem" },
				"2": { value: "0.5rem" },
				"3": { value: "0.75rem" },
				"4": { value: "1rem" },
				"5": { value: "1.5rem" },
				"6": { value: "2rem" },
				full: { value: "100%" },
				// 2.75rem control height, 44px touch target: WCAG 2.5.8.
				control: { value: "2.75rem" },
				touch: { value: "44px" },
				prose: { value: "68ch" },
				// Named layout columns, so a grid track never carries a literal.
				route: { value: "60vh" },
				railNarrow: { value: "20rem" },
				rail: { value: "22rem" },
				formColumn: { value: "26rem" },
				castMeasure: { value: "22ch" },
				castRing: { value: "12vmin" },
				measure: { value: "34rem" },
				content: { value: "76rem" },
				wide: { value: "96rem" },
			},
			durations: {
				instant: { value: "120ms" },
				fast: { value: "180ms" },
				base: { value: "240ms" },
				slow: { value: "420ms" },
			},
			easings: {
				// ease-out-expo for entrances, standard for state changes.
				entrance: { value: "cubic-bezier(0.16, 1, 0.3, 1)" },
				standard: { value: "cubic-bezier(0.4, 0, 0.2, 1)" },
				// A clock sweep is a measurement, so it must not ease.
				linear: { value: "linear" },
			},
			assets: {
				// backgroundImage resolves against `assets`, so the countdown
				// sweep is a token rather than an inline gradient string.
				castSweep: {
					value:
						"conic-gradient({colors.live} var(--arcade-sweep), {colors.surface} 0)",
				},
			},
			shadows: {
				// Academy dark-mode elevation. Nothing softer, nothing wider.
				low: { value: "0 2px 6px rgba(0, 0, 0, 0.4)" },
				mid: { value: "0 8px 24px rgba(0, 0, 0, 0.5)" },
			},
			zIndex: {
				// Semantic scale. No 999.
				base: { value: "0" },
				raised: { value: "10" },
				sticky: { value: "20" },
				overlay: { value: "30" },
				modal: { value: "40" },
				toast: { value: "50" },
			},
		},
		semanticTokens: {
			colors: {
				// State vocabulary. Components reference these, not the raw
				// hue, so "what does amber mean" has exactly one answer.
				live: { value: "{colors.amber}" },
				liveDim: { value: "{colors.amberDim}" },
				action: { value: "{colors.spruce}" },
				actionDim: { value: "{colors.spruceDim}" },
				correct: { value: "{colors.spruce}" },
				wrong: { value: "{colors.rust}" },
				closed: { value: "{colors.rust}" },
				crowd: { value: "{colors.violet}" },
				crowdDim: { value: "{colors.violetDim}" },
			},
		},
		textStyles: {
			display: {
				value: {
					fontFamily: "display",
					fontSize: "display",
					fontWeight: "regular",
					lineHeight: "tight",
					letterSpacing: "display",
				},
			},
			headline: {
				value: {
					fontFamily: "body",
					fontSize: "headline",
					fontWeight: "medium",
					lineHeight: "tight",
					letterSpacing: "headline",
				},
			},
			title: {
				value: {
					fontFamily: "body",
					fontSize: "title",
					fontWeight: "bold",
					lineHeight: "snug",
					letterSpacing: "title",
				},
			},
			body: {
				value: {
					fontFamily: "body",
					fontSize: "body",
					fontWeight: "regular",
					lineHeight: "normal",
					letterSpacing: "normal",
				},
			},
			bodySm: {
				value: {
					fontFamily: "body",
					fontSize: "bodySm",
					fontWeight: "regular",
					lineHeight: "normal",
					letterSpacing: "normal",
				},
			},
			label: {
				value: {
					fontFamily: "mono",
					fontSize: "label",
					fontWeight: "semibold",
					lineHeight: "none",
					letterSpacing: "label",
					textTransform: "uppercase",
				},
			},
			tally: {
				value: {
					fontFamily: "mono",
					fontSize: "tally",
					fontWeight: "semibold",
					lineHeight: "flat",
					letterSpacing: "title",
					fontVariantNumeric: "tabular-nums",
				},
			},
			// Broadcast scale. Two tones only; inkSoft and inkMute do not
			// survive the stream encoder.
			castLabel: {
				value: {
					fontFamily: "mono",
					fontSize: "castLabel",
					fontWeight: "semibold",
					lineHeight: "none",
					letterSpacing: "label",
					textTransform: "uppercase",
				},
			},
			castBody: {
				value: {
					fontFamily: "body",
					fontSize: "castBody",
					fontWeight: "medium",
					lineHeight: "snug",
					letterSpacing: "normal",
				},
			},
			castTitle: {
				value: {
					fontFamily: "body",
					fontSize: "castTitle",
					fontWeight: "bold",
					lineHeight: "snug",
					letterSpacing: "title",
				},
			},
			castHeadline: {
				value: {
					fontFamily: "body",
					fontSize: "castHeadline",
					fontWeight: "bold",
					lineHeight: "tight",
					letterSpacing: "headline",
				},
			},
			castTally: {
				value: {
					fontFamily: "mono",
					fontSize: "castTally",
					fontWeight: "semibold",
					lineHeight: "flat",
					letterSpacing: "headline",
					fontVariantNumeric: "tabular-nums",
				},
			},
			castHero: {
				value: {
					fontFamily: "display",
					fontSize: "castHero",
					fontWeight: "regular",
					lineHeight: "flat",
					letterSpacing: "display",
				},
			},
		},
		keyframes: {
			tally: {
				"0%": { opacity: "0.35", transform: "translateY(0.15em)" },
				"100%": { opacity: "1", transform: "translateY(0)" },
			},
			onAir: {
				"0%, 100%": { opacity: "1" },
				"50%": { opacity: "0.45" },
			},
			sweep: {
				"0%": { "--arcade-sweep": "0deg" },
				"100%": { "--arcade-sweep": "360deg" },
			},
		},
	},
});
