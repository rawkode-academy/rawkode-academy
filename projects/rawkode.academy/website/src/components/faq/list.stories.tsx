import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import FAQList from "./list.vue";

const meta = {
	title: "Components/FAQ/List",
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

export const Default: Story = {
	args: {
		component: FAQList,
		props: {},
	},
};
