import type { StoryObj } from "@storybook/vue3";
import MastheadBar from "./MastheadBar.vue";

const meta = {
	title: "UI/Editorial/MastheadBar",
	component: MastheadBar,
	tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof MastheadBar>;

export const Default: Story = {
	render: (args) => ({
		components: { MastheadBar },
		setup: () => ({ args }),
		template: `<MastheadBar v-bind="args" />`,
	}),
	args: {
		left: "Dispatch №048 · Vol IV",
		right: "Thursday, April 23 2026",
		quote: "The only cloud native content where I actually learn something.",
		quoteSource: "Principal Engineer, Stripe",
	},
};

export const NoQuote: Story = {
	render: (args) => ({
		components: { MastheadBar },
		setup: () => ({ args }),
		template: `<MastheadBar v-bind="args" />`,
	}),
	args: {
		left: "Section §02",
		right: "06 / 09 shown",
	},
};
