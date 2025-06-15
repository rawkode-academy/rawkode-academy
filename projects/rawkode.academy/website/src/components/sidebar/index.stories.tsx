import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Sidebar from "./index.vue";

const meta = {
	title: "Components/Sidebar/Index",
	component: VueInReact,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
	argTypes: {
		component: {
			table: { disable: true },
		},
	},
} satisfies Meta<typeof VueInReact>;

export default meta;
type Story = StoryObj<typeof meta>;

// Since the original stories used custom render functions with templates,
// we'll create wrapper components for proper layout
const SidebarWithContent = {
	components: { Sidebar },
	template: `
    <div class="relative h-screen">
      <Sidebar />
      <div class="ml-64 p-8 bg-gray-50 dark:bg-gray-900 h-full">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Page Content</h1>
        <p class="text-gray-600 dark:text-gray-400">The sidebar is shown on the left side of this content.</p>
      </div>
    </div>
  `,
};

const SidebarWithContentDark = {
	components: { Sidebar },
	template: `
    <div class="relative h-screen dark">
      <Sidebar />
      <div class="ml-64 p-8 bg-gray-50 dark:bg-gray-900 h-full">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Dark Mode</h1>
        <p class="text-gray-600 dark:text-gray-400">The sidebar adapts to dark mode styling.</p>
      </div>
    </div>
  `,
};

export const Default: Story = {
	args: {
		component: SidebarWithContent,
		props: {},
	},
};

export const DarkMode: Story = {
	args: {
		component: SidebarWithContentDark,
		props: {},
	},
};
