import type { Meta, StoryObj } from "@storybook/react";
import { defineComponent, h } from "vue";
import { VueInReact } from "../vue-wrapper";
import LiveDot from "./LiveDot.vue";

const meta = {
	title: "Components/UI/LiveDot",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const colors = ["amber", "spruce", "rust", "ink"] as const;

const ColorsSpecimen = defineComponent({
	setup: () => () =>
		h(
			"div",
			{ style: "display:flex;gap:1.5rem;align-items:center;padding:1rem" },
			colors.map((color) => h(LiveDot, { color })),
		),
});

export const Default: Story = {
	render: () => (
		<div style={{ padding: "1rem" }}>
			<VueInReact component={LiveDot} props={{ color: "amber", size: 7 }} />
		</div>
	),
};

export const Colors: Story = {
	render: () => <VueInReact component={ColorsSpecimen} />,
};
