import type { StorybookConfig } from "@storybook/vue3-vite";

export const vueConfig: Partial<StorybookConfig> = {
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
  stories: ["../src/**/*.vue.stories.@(js|jsx|mjs|ts|tsx)"],
};