import type { StoryObj } from "@storybook/vue3";
import CommandBar from "./CommandBar.vue";

const meta = {
	title: "UI/OpsConsole/CommandBar",
	component: CommandBar,
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
		backgrounds: { default: "mocha" },
	},
	decorators: [
		() => ({
			template: `<div class="dark" style="min-height: 100vh; background: var(--ctp-mocha-base);"><story /></div>`,
			mounted() {
				document.documentElement.classList.add("dark");
			},
			unmounted() {
				document.documentElement.classList.remove("dark");
			},
		}),
	],
};
export default meta;
type Story = StoryObj<typeof CommandBar>;

export const Default: Story = {
	render: () => ({
		components: { CommandBar },
		template: `<CommandBar current-path="/watch" />`,
	}),
};

export const ActiveMatrix: Story = {
	render: () => ({
		components: { CommandBar },
		template: `<CommandBar current-path="/technology/matrix" />`,
	}),
};

export const CustomLinks: Story = {
	render: () => ({
		components: { CommandBar },
		setup: () => ({
			links: [
				{ label: "Watch", href: "/watch" },
				{ label: "Courses", href: "/courses" },
			],
		}),
		template: `<CommandBar :links="links" current-path="/courses" cta-label="Sign in" />`,
	}),
};
