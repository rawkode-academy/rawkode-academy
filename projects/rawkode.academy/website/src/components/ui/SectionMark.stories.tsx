import type { StoryObj } from "@storybook/vue3";
import SectionMark from "./SectionMark.vue";

const meta = {
	title: "UI/Editorial/SectionMark",
	component: SectionMark,
	tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof SectionMark>;

export const Default: Story = {
	render: (args) => ({
		components: { SectionMark },
		setup: () => ({ args }),
		template: `<SectionMark v-bind="args" />`,
	}),
	args: { num: 0, label: "Hands-on cloud native", dot: true, tone: "accent" },
};

export const Variants: Story = {
	render: () => ({
		components: { SectionMark },
		template: `
			<div style="display:flex;flex-direction:column;gap:0.75rem">
				<SectionMark :num="0" label="Lede" tone="accent" :dot="true" />
				<SectionMark :num="1" label="Courses" />
				<SectionMark :num="2" label="Coverage" />
				<SectionMark :num="14" label="Featured course" tone="rust" />
			</div>
		`,
	}),
};
