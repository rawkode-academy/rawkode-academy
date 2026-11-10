import type { Meta, StoryObj } from "@storybook/react";
import { defineComponent, h } from "vue";
import { VueInReact } from "../vue-wrapper";
import EmptyState from "./EmptyState.vue";

const meta = {
	title: "Components/UI/EmptyState",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const WithActionsSpecimen = defineComponent({
	setup: () => () =>
		h(
			EmptyState,
			{ title: "Nothing matched “service mesh”." },
			{
				actions: () => [
					h("a", { href: "#" }, "Clear filters"),
					h("a", { href: "#" }, "Browse all videos"),
				],
			},
		),
});

const StartAlignedSpecimen = defineComponent({
	setup: () => () =>
		h(
			EmptyState,
			{
				title: "More courses launching soon",
				body: "Kubernetes, platform engineering, and identity courses are next.",
				align: "start",
			},
			{ actions: () => [h("a", { href: "#" }, "Get notified")] },
		),
});

export const Default: Story = {
	render: () => (
		<VueInReact
			component={EmptyState}
			props={{
				title: "No articles match these filters.",
				body: "Try a broader keyword, or clear the active filters to browse the full archive.",
			}}
		/>
	),
};

export const WithActions: Story = {
	render: () => <VueInReact component={WithActionsSpecimen} />,
};

export const StartAligned: Story = {
	render: () => <VueInReact component={StartAlignedSpecimen} />,
};
