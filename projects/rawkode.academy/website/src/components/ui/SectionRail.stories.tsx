import type { StoryObj } from "@storybook/vue3";
import SectionRail from "./SectionRail.vue";

const meta = {
	title: "UI/Editorial/SectionRail",
	component: SectionRail,
	tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof SectionRail>;

export const SixSection: Story = {
	render: () => ({
		components: { SectionRail },
		setup: () => ({
			items: [
				{ num: 1, label: "Courses", href: "#courses" },
				{ num: 2, label: "Coverage", href: "#coverage" },
				{ num: 3, label: "Instructor", href: "#instructor" },
				{ num: 4, label: "Praise", href: "#praise" },
				{ num: 5, label: "Schedule", href: "#schedule" },
				{ num: 6, label: "Field notes", href: "#notes" },
			],
		}),
		template: `<SectionRail :items="items" />`,
	}),
};
