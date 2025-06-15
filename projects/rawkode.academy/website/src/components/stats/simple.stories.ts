import type { Meta, StoryObj } from "@storybook/react";
import { SimpleStatsWrapper } from "./SimpleStatsWrapper";

const meta = {
	title: "Components/Stats/Simple",
	component: SimpleStatsWrapper,
	tags: ["autodocs"],
	argTypes: {
		title: { control: "text" },
	},
} satisfies Meta<typeof SimpleStatsWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		title: "Our Impact",
		stats: [
			{ label: "Active Students", value: "2,500+" },
			{ label: "Video Hours", value: "1,200+" },
			{ label: "Community Members", value: "5,000+" },
		],
	},
};

export const Growth: Story = {
	args: {
		title: "Platform Growth",
		stats: [
			{ label: "Monthly Views", value: "50K+" },
			{ label: "Countries Reached", value: "120+" },
			{ label: "Courses Published", value: "25" },
		],
	},
};

export const Engagement: Story = {
	args: {
		title: "Community Engagement",
		stats: [
			{ label: "Discord Members", value: "3.2K" },
			{ label: "GitHub Stars", value: "850" },
			{ label: "Contributors", value: "45" },
		],
	},
};
