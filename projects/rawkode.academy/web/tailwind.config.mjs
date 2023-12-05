import * as colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "media",
	content: [
		"./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
		"./node_modules/flowbite/**/*.js",
	],
	theme: {
		extend: {
			colors: {
				primary: colors.green,
				secondary: colors.teal,
				tertiary: colors.indigo,
			},
			fontFamily: {
				body: [
					"Monasans",
					"ui-sans-serif",
					"system-ui",
					"-apple-system",
					"system-ui",
					"Segoe UI",
					"Roboto",
					"Helvetica Neue",
					"Arial",
					"Noto Sans",
					"sans-serif",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
					"Noto Color Emoji",
				],
				sans: [
					"Monasans",
					"ui-sans-serif",
					"system-ui",
					"-apple-system",
					"system-ui",
					"Segoe UI",
					"Roboto",
					"Helvetica Neue",
					"Arial",
					"Noto Sans",
					"sans-serif",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
					"Noto Color Emoji",
				],
			},
		},
	},
	plugins: [require("flowbite/plugin"), require("flowbite-typography")],
};
