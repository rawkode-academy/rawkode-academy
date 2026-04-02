import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: false,

	include: [
		"./src/**/*.{js,jsx,ts,tsx,astro}",
		"./pages/**/*.{js,jsx,ts,tsx,astro}",
	],

	exclude: [],

	theme: {
		extend: {
			tokens: {
				colors: {
					primary: { value: "#04B59C" },
					secondary: { value: "#85FF95" },
				},
			},
			semanticTokens: {
				colors: {
					fg: {
						default: {
							value: { base: "{colors.gray.900}", _dark: "{colors.white}" },
						},
						muted: {
							value: {
								base: "{colors.gray.700}",
								_dark: "{colors.gray.300}",
							},
						},
						subtle: {
							value: {
								base: "{colors.gray.500}",
								_dark: "{colors.gray.400}",
							},
						},
					},
					bg: {
						canvas: {
							value: { base: "{colors.white}", _dark: "{colors.gray.900}" },
						},
						muted: {
							value: {
								base: "{colors.gray.100}",
								_dark: "{colors.gray.800}",
							},
						},
						subtle: {
							value: {
								base: "{colors.gray.200}",
								_dark: "{colors.gray.700}",
							},
						},
					},
				},
			},
		},
	},

	jsxFramework: "react",

	outdir: "styled-system",
});
