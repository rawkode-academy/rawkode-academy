import type { StoryObj } from "@storybook/vue3";
import CommandBar from "./CommandBar.vue";

const meta = {
	title: "UI/Editorial/CommandBar",
	component: CommandBar,
	tags: ["autodocs"],
	parameters: {
		layout: "fullscreen",
	},
};
export default meta;
type Story = StoryObj<typeof CommandBar>;

export const Default: Story = {
	render: () => ({
		components: { CommandBar },
		template: `<CommandBar />`,
	}),
};

export const CustomLinks: Story = {
	render: () => ({
		components: { CommandBar },
		setup: () => ({
			links: [
				{ label: "Courses", href: "/courses" },
				{ label: "Dispatch", href: "/read" },
			],
		}),
		template: `<CommandBar :links="links" cta-label="Sign up" />`,
	}),
};
