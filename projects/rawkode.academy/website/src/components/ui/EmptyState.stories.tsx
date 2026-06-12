import type { StoryObj } from "@storybook/vue3";
import EmptyState from "./EmptyState.vue";

const meta = {
	title: "UI/Editorial/EmptyState",
	component: EmptyState,
	tags: ["autodocs"],
	argTypes: {
		align: {
			control: "select",
			options: ["center", "start"],
		},
	},
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
	render: (args) => ({
		components: { EmptyState },
		setup: () => ({ args }),
		template: `<EmptyState v-bind="args" />`,
	}),
	args: {
		title: "No articles match these filters.",
		body: "Try a broader keyword, or clear the active filters to browse the full archive.",
	},
};

export const WithActions: Story = {
	render: (args) => ({
		components: { EmptyState },
		setup: () => ({ args }),
		template: `
			<EmptyState v-bind="args">
				<template #actions>
					<a href="#">Clear filters</a>
					<a href="#">Browse all videos →</a>
				</template>
			</EmptyState>
		`,
	}),
	args: {
		title: "Nothing matched “service mesh”.",
	},
};

export const StartAligned: Story = {
	render: (args) => ({
		components: { EmptyState },
		setup: () => ({ args }),
		template: `
			<EmptyState v-bind="args">
				<template #actions>
					<a href="#">Get notified →</a>
				</template>
			</EmptyState>
		`,
	}),
	args: {
		title: "More courses launching soon",
		body: "Kubernetes, platform engineering, and identity deep dives are next.",
		align: "start",
	},
};
