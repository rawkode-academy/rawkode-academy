import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import HeroTiles from "./tiles.vue";

const meta = {
	title: "Components/Hero/Tiles",
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
		component: HeroTiles,
		props: {
			title: "Welcome to Rawkode Academy",
		},
	},
};

export const LongerTitle: Story = {
	args: {
		component: HeroTiles,
		props: {
			title: "Learn Cloud Native Technologies with Our Expert-Led Courses",
		},
	},
};
