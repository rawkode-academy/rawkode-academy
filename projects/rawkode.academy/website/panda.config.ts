import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: false,
	include: ["./src/**/*.{vue,ts,tsx,astro}"],
	exclude: [],
	outdir: "styled-system",
	jsxFramework: "vue",
	theme: {
		extend: {
			tokens: {
				colors: {
					primary: {
						value: "{colors.teal.500}",
					},
					secondary: {
						value: "{colors.green.300}",
					},
				},
			},
			semanticTokens: {
				colors: {
					primary: {
						value: "{colors.teal.500}",
					},
					secondary: {
						value: "{colors.green.300}",
					},
					accent: {
						value: "{colors.gray.800}",
					},
					"surface.default": {
						value: {
							base: "{colors.white}",
							_dark: "{colors.gray.900}",
						},
					},
					"surface.muted": {
						value: {
							base: "{colors.gray.50}",
							_dark: "{colors.gray.800}",
						},
					},
					"text.default": {
						value: {
							base: "{colors.gray.900}",
							_dark: "{colors.white}",
						},
					},
					"text.muted": {
						value: {
							base: "{colors.gray.600}",
							_dark: "{colors.gray.400}",
						},
					},
					"text.subtle": {
						value: {
							base: "{colors.gray.500}",
							_dark: "{colors.gray.400}",
						},
					},
					"border.default": {
						value: {
							base: "{colors.gray.200}",
							_dark: "{colors.gray.700}",
						},
					},
					"border.subtle": {
						value: {
							base: "rgba(255, 255, 255, 0.2)",
							_dark: "rgba(55, 65, 81, 0.4)",
						},
					},
				},
			},
		},
	},
});
