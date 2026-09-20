import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: ["@storybook/addon-links"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	viteFinal: async (config) => {
		const { default: vue } = await import("@vitejs/plugin-vue");
		const { resolve } = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const { mergeConfig } = await import("vite");

		const __dirname = fileURLToPath(new URL(".", import.meta.url));

		return mergeConfig(config, {
			// The installed React plugin requires Vite 8; this workspace uses
			// Vite 7. Its native JSX transform is sufficient for review stories.
			plugins: [vue()],
			esbuild: { jsx: "automatic" },
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
