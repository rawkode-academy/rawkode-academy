import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	include: ["./src/**/*.{ts,tsx,js,jsx,astro,vue}"],
	exclude: [],
	outdir: "styled-system",

	theme: {
		extend: {
			tokens: {
				colors: {
					brand: {
						primary: { value: "rgb(4, 181, 156)" },
						secondary: { value: "rgb(133, 255, 149)" },
						accent: { value: "rgb(35, 40, 45)" },
					},
				},
				fonts: {
					display: { value: "var(--font-quicksand), sans-serif" },
					body: { value: "var(--font-poppins), sans-serif" },
					mono: { value: "var(--font-monaspace-neon), monospace" },
				},
				spacing: {
					page: { value: "clamp(1rem, 3vw, 1.75rem)" },
					section: { value: "clamp(3rem, 6vw, 5rem)" },
					stack: { value: "clamp(1.5rem, 3.5vw, 2.5rem)" },
				},
			},
			semanticTokens: {
				colors: {
					surface: {
						base: {
							value: { base: "#f5f7ff", _dark: "#030617" },
						},
						card: {
							value: {
								base: "rgba(255, 255, 255, 0.85)",
								_dark: "rgba(8, 14, 31, 0.9)",
							},
						},
						border: {
							value: {
								base: "rgba(0, 0, 0, 0.08)",
								_dark: "rgba(255, 255, 255, 0.08)",
							},
						},
					},
					text: {
						primary: {
							value: { base: "rgb(17, 24, 39)", _dark: "rgb(255, 255, 255)" },
						},
						secondary: {
							value: { base: "rgb(55, 65, 81)", _dark: "rgb(209, 213, 219)" },
						},
						muted: {
							value: { base: "rgb(107, 114, 128)", _dark: "rgb(156, 163, 175)" },
						},
					},
				},
			},
			recipes: {
				button: {
					className: "button",
					base: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: "lg",
						fontWeight: "medium",
						transition: "all 0.2s",
						cursor: "pointer",
						fontFamily: "body",
					},
					variants: {
						variant: {
							primary: {
								bg: "brand.primary",
								color: "white",
								_hover: { filter: "brightness(1.1)" },
							},
							secondary: {
								bg: "surface.card",
								color: "text.primary",
								border: "1px solid",
								borderColor: "surface.border",
								_hover: { opacity: 0.9 },
							},
							ghost: {
								bg: "transparent",
								color: "text.secondary",
								_hover: { bg: "surface.card" },
							},
						},
						size: {
							sm: { px: "3", py: "1.5", fontSize: "sm" },
							md: { px: "4", py: "2", fontSize: "md" },
							lg: { px: "6", py: "3", fontSize: "lg" },
						},
					},
					defaultVariants: {
						variant: "primary",
						size: "md",
					},
				},
				card: {
					className: "card",
					base: {
						bg: "surface.card",
						backdropFilter: "blur(24px)",
						borderRadius: "xl",
						border: "1px solid",
						borderColor: "surface.border",
						overflow: "hidden",
						transition: "all 0.2s",
					},
					variants: {
						hover: {
							true: {
								_hover: {
									transform: "translateY(-2px)",
									boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
								},
							},
						},
						padding: {
							none: {},
							sm: { p: "4" },
							md: { p: "6" },
							lg: { p: "8" },
						},
					},
					defaultVariants: {
						hover: true,
						padding: "md",
					},
				},
				badge: {
					className: "badge",
					base: {
						display: "inline-flex",
						alignItems: "center",
						px: "2.5",
						py: "0.5",
						borderRadius: "full",
						fontSize: "xs",
						fontWeight: "medium",
					},
					variants: {
						variant: {
							primary: {
								bg: "brand.primary",
								color: "white",
							},
							secondary: {
								bg: "surface.card",
								color: "text.primary",
								border: "1px solid",
								borderColor: "surface.border",
							},
							success: {
								bg: "green.100",
								color: "green.800",
							},
						},
					},
					defaultVariants: {
						variant: "secondary",
					},
				},
			},
		},
	},

	patterns: {
		extend: {
			glassPanel: {
				description: "Glass morphism panel",
				transform() {
					return {
						backgroundColor: "surface.card",
						backdropFilter: "blur(24px)",
						borderRadius: "xl",
						border: "1px solid",
						borderColor: "surface.border",
					};
				},
			},
			stack: {
				description: "Vertical or horizontal stack with gap",
				properties: {
					direction: { type: "enum", value: ["column", "row"] },
					gap: { type: "token", value: "spacing" },
				},
				transform(props) {
					const { direction = "column", gap = "4" } = props;
					return {
						display: "flex",
						flexDirection: direction,
						gap,
					};
				},
			},
			grid: {
				description: "Responsive grid layout",
				properties: {
					columns: { type: "number" },
					gap: { type: "token", value: "spacing" },
				},
				transform(props) {
					const { columns = 1, gap = "4" } = props;
					return {
						display: "grid",
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
						gap,
					};
				},
			},
		},
	},

	conditions: {
		extend: {
			dark: "[data-theme='dark'] &, .dark &",
		},
	},

	globalCss: {
		body: {
			bg: "surface.base",
			color: "text.primary",
			fontFamily: "body",
			minHeight: "100vh",
		},
		"h1, h2, h3, h4, h5, h6": {
			fontFamily: "display",
		},
	},
});
