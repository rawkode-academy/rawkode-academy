/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "media",
	content: [
		"./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
		"./node_modules/flowbite/**/*.{js,jsx,ts,tsx}",
	],
	theme: {
		extend: {
			colors: {
				primary: "#5F5ED7",
				secondary: "#00CEFF",
				tertiary: "#04B59C",
				quaternary: "#85FF95",
				black: "#111827",
			},
			fontFamily: {
				display: ["Quicksand"],
				body: ["Poppins"],
				mono: ["Monaspace"],
			},
		},
	},
	plugins: [require("flowbite/plugin"), require("flowbite-typography")],
};
