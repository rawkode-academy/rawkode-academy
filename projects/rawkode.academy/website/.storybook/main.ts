import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const config: StorybookConfig = {
	stories: [
		"../src/**/*.mdx",
		"../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
		"../src/**/*.vue.stories.@(js|jsx|mjs|ts|tsx)",
	],
	addons: [
		"@storybook/addon-links",
		"@storybook/addon-essentials",
		"@storybook/addon-interactions",
	],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	core: {
		builder: "@storybook/builder-vite",
	},
	viteFinal: async (config, { configType }) => {
		// Add Tailwind CSS support
		const { default: tailwindcss } = await import("@tailwindcss/vite");

		return mergeConfig(config, {
			plugins: [react(), vue(), tailwindcss()],
			resolve: {
				alias: {
					"@": resolve(__dirname, "../src"),
				},
			},
			optimizeDeps: {
				include: ["vue"],
			},
		});
	},
};

export default config;
