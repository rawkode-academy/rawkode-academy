import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: ["@storybook/addon-links"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	viteFinal: async (config, { configType }) => {
		const { default: vue } = await import("@vitejs/plugin-vue");
		const { default: react } = await import("@vitejs/plugin-react");
		const { default: tailwindcss } = await import("@tailwindcss/vite");
		const { resolve } = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const { mergeConfig } = await import("vite");

		const __dirname = fileURLToPath(new URL(".", import.meta.url));

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
