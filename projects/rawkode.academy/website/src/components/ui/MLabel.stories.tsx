import type { StoryObj } from "@storybook/vue3";
import MLabel from "./MLabel.vue";

const meta = {
	title: "UI/Editorial/MLabel",
	component: MLabel,
	tags: ["autodocs"],
	argTypes: {
		tone: {
			control: "select",
			options: ["muted", "soft", "ink", "accent", "amber", "rust", "spruce"],
		},
	},
};
export default meta;
type Story = StoryObj<typeof MLabel>;

export const Default: Story = {
	render: (args) => ({
		components: { MLabel },
		setup: () => ({ args }),
		template: `<MLabel v-bind="args">§00 · Dispatch</MLabel>`,
	}),
	args: { tone: "muted" },
};

export const Tones: Story = {
	render: () => ({
		components: { MLabel },
		template: `
			<div style="display:flex;flex-direction:column;gap:0.75rem">
				<MLabel tone="muted">§00 · Muted</MLabel>
				<MLabel tone="soft">§01 · Soft</MLabel>
				<MLabel tone="ink">§02 · Ink</MLabel>
				<MLabel tone="accent">§03 · Accent (spruce)</MLabel>
				<MLabel tone="amber">§04 · Amber</MLabel>
				<MLabel tone="rust">§05 · Rust</MLabel>
			</div>
		`,
	}),
};
