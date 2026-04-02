import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	presets: [
		"@pandacss/dev/presets",
	],

	include: [
		"./src/**/*.{astro,vue,tsx,ts,jsx,js}",
	],
	exclude: [
		"./src/components/game/**",
		"./node_modules",
	],

	jsxFramework: "vue",
	outdir: "styled-system",

	globalCss: {
		html: {
			scrollBehavior: "smooth",
		},
		body: {
			position: "relative",
			minHeight: "100vh",
			overflowX: "hidden",
			fontFamily: "body",
			color: "fg.default",
			bg: "bg.canvas",
		},
	},

	theme: {
		extend: {
			tokens: {
				fonts: {
					display: { value: "var(--font-quicksand), sans-serif" },
					body: { value: "var(--font-poppins), sans-serif" },
					mono: { value: "var(--font-monaspace-neon), monospace" },
				},
				spacing: {
					"page-sm": { value: "clamp(1rem, 3vw, 1.75rem)" },
					page: { value: "clamp(1.5rem, 4vw, 3rem)" },
					"page-lg": { value: "clamp(2rem, 5vw, 4rem)" },
					"section-tight": { value: "clamp(2rem, 5vw, 3.75rem)" },
					section: { value: "clamp(3rem, 6vw, 5rem)" },
					"section-relaxed": { value: "clamp(4rem, 7vw, 6rem)" },
					"stack-sm": { value: "clamp(1rem, 3vw, 1.75rem)" },
					stack: { value: "clamp(1.5rem, 3.5vw, 2.5rem)" },
					"stack-lg": { value: "clamp(2rem, 4.5vw, 3.25rem)" },
					card: { value: "clamp(1.25rem, 3vw, 2.25rem)" },
					"card-lg": { value: "clamp(1.75rem, 4vw, 2.75rem)" },
				},
				colors: {
					brand: {
						primary: { value: "#04B59C" },
						secondary: { value: "#85FF95" },
						accent: { value: "#23282D" },
					},
				},
			},

			semanticTokens: {
				colors: {
					surface: {
						base: {
							value: { base: "#f5f7ff", _dark: "#030617" },
						},
						overlay: {
							value: { base: "rgba(255, 255, 255, 0.92)", _dark: "rgba(6, 11, 27, 0.92)" },
						},
						card: {
							value: { base: "rgba(255, 255, 255, 0.85)", _dark: "rgba(8, 14, 31, 0.9)" },
						},
						cardMuted: {
							value: { base: "rgba(15, 23, 42, 0.05)", _dark: "rgba(148, 163, 184, 0.08)" },
						},
					},
				},
				shadows: {
					surface: {
						value: { base: "0 30px 80px rgba(15, 23, 42, 0.15)", _dark: "0 35px 120px rgba(2, 6, 23, 0.65)" },
					},
					surfaceStrong: {
						value: { base: "0 25px 80px rgba(15, 23, 42, 0.2)", _dark: "0 45px 120px rgba(2, 6, 23, 0.75)" },
					},
				},
			},

			recipes: {
				glassPanel: {
					className: "glass-panel",
					base: {
						border: "1px solid",
						borderColor: "border.subtle",
						backdropFilter: "blur(40px)",
						borderRadius: "xl",
						backgroundColor: "surface.card",
						boxShadow: "surface",
					},
					variants: {
						variant: {
							panel: {},
							card: {
								backdropFilter: "blur(20px)",
							},
							shimmer: {
								position: "relative",
								overflow: "hidden",
								backdropFilter: "blur(20px)",
							},
						},
						size: {
							sm: { borderRadius: "lg", padding: "3" },
							md: { borderRadius: "xl", padding: "5" },
							lg: { borderRadius: "2xl", padding: "8" },
						},
					},
					defaultVariants: {
						variant: "panel",
					},
				},

				glassChip: {
					className: "glass-chip",
					base: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: "full",
						px: "3",
						py: "1",
						fontSize: "xs",
						fontWeight: "semibold",
						backgroundColor: "surface.cardMuted",
						border: "1px solid",
						borderColor: "border.subtle",
					},
				},

				glassInteractive: {
					className: "glass-interactive",
					base: {
						backdropFilter: "blur(12px)",
						borderRadius: "lg",
						transition: "all",
						transitionDuration: "200ms",
						backgroundColor: { base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(31, 41, 55, 0.3)" },
						border: "1px solid",
						borderColor: { base: "rgba(255, 255, 255, 0.4)", _dark: "rgba(75, 85, 99, 0.4)" },
						_hover: {
							backgroundColor: { base: "rgba(255, 255, 255, 0.5)", _dark: "rgba(55, 65, 81, 0.5)" },
							shadow: "md",
							transform: "scale(1.05)",
						},
					},
				},
			},

			keyframes: {
				gradientShift: {
					"0%": { backgroundPosition: "0% 50%" },
					"50%": { backgroundPosition: "100% 50%" },
					"100%": { backgroundPosition: "0% 50%" },
				},
			},
		},
	},

	conditions: {
		extend: {
			rawkodeBlue: '[data-theme="rawkode-blue"] &',
			catppuccin: '[data-theme="catppuccin"] &',
			dracula: '[data-theme="dracula"] &',
			solarized: '[data-theme="solarized"] &',
			pride: '[data-theme="pride"] &',
			lgbtq: '[data-theme="lgbtq"] &',
		},
	},
});
