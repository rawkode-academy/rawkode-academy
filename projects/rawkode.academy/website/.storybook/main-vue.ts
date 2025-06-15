import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.vue.stories.@(js|jsx|mjs|ts|tsx)"],
	framework: {
		name: "@storybook/vue3-vite",
		options: {},
	},
};

export default config;
