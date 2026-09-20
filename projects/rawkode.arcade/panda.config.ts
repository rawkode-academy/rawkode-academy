import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
	include: ["./src/**/*.{astro,ts,vue}"],
	exclude: ["./src/**/*.test.ts"],
	outdir: "./styled-system",
	jsxFramework: "vue",
	strictTokens: true,
	theme: {
		extend: {
			tokens: {
				colors: {
					arcade: {
						ink: { value: "#080d1d" },
						panel: { value: "#101a35" },
						panelRaised: { value: "#18264a" },
						cyan: { value: "#4de8ff" },
						violet: { value: "#9577ff" },
						lime: { value: "#c9ff63" },
						amber: { value: "#ffc857" },
						coral: { value: "#ff6b7a" },
						cloud: { value: "#e9eeff" },
						mist: { value: "#aebbd9" },
						line: { value: "rgb(174 187 217 / 20%)" },
						pink: { value: "#ff83d3" },
					},
				},
				radii: {
					arcade: { value: "20px" },
					control: { value: "12px" },
				},
				fonts: {
					display: {
						value: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
					},
					body: { value: "'Inter', ui-sans-serif, system-ui, sans-serif" },
					mono: {
						value: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
					},
				},
			},
			semanticTokens: {
				colors: {
					canvas: { value: "{colors.arcade.ink}" },
					surface: { value: "{colors.arcade.panel}" },
					foreground: { value: "{colors.arcade.cloud}" },
					muted: { value: "{colors.arcade.mist}" },
					accent: { value: "{colors.arcade.cyan}" },
				},
			},
			recipes: {
				arcadeCard: {
					className: "arcade-card",
					base: {
						borderWidth: "1px",
						borderColor: "arcade.line",
						borderRadius: "arcade",
						bg: "arcade.panel",
					},
					variants: {
						tone: {
							default: {},
							raised: { bg: "arcade.panelRaised" },
							live: { borderColor: "arcade.cyan" },
						},
						padding: { compact: { p: "3" }, comfortable: { p: "5" } },
					},
					defaultVariants: { tone: "default", padding: "comfortable" },
				},
				arcadeControl: {
					className: "arcade-control",
					base: {
						borderRadius: "control",
						fontWeight: "bold",
						transitionDuration: "fast",
						transitionProperty: "colors",
					},
					variants: {
						tone: {
							accent: { bg: "arcade.cyan", color: "arcade.ink" },
							outline: {
								borderWidth: "1px",
								borderColor: "arcade.cyan",
								color: "arcade.cyan",
							},
							quiet: { bg: "arcade.panelRaised", color: "arcade.cloud" },
						},
						size: {
							sm: { px: "3", py: "2", fontSize: "sm" },
							md: { px: "4", py: "3", fontSize: "sm" },
						},
					},
					defaultVariants: { tone: "accent", size: "md" },
				},
			},
		},
	},
});
