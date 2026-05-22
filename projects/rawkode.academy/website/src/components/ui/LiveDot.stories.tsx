import type { StoryObj } from "@storybook/vue3";
import LiveDot from "./LiveDot.vue";

const meta = {
	title: "UI/Editorial/LiveDot",
	component: LiveDot,
	tags: ["autodocs"],
	argTypes: {
		color: { control: "select", options: ["amber", "spruce", "rust", "ink"] },
		size: { control: { type: "number", min: 4, max: 16 } },
	},
};
export default meta;
type Story = StoryObj<typeof LiveDot>;

export const Default: Story = {
	render: (args) => ({
		components: { LiveDot },
		setup: () => ({ args }),
		template: `<div style="padding:1rem"><LiveDot v-bind="args" /></div>`,
	}),
	args: { color: "amber", size: 7 },
};

export const Colors: Story = {
	render: () => ({
		components: { LiveDot },
		template: `
			<div style="display:flex;gap:1.5rem;align-items:center;padding:1rem">
				<LiveDot color="amber" />
				<LiveDot color="spruce" />
				<LiveDot color="rust" />
				<LiveDot color="ink" />
			</div>
		`,
	}),
};
