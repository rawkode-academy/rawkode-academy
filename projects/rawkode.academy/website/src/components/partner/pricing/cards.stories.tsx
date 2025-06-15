import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../../vue-wrapper";
import PricingCards from "./cards.vue";

const meta = {
	title: "Components/Partner/Pricing/Cards",
	component: VueInReact,
	parameters: {
		layout: "padded",
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
		component: PricingCards,
		props: {},
	},
};
