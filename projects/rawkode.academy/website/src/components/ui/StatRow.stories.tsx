import type { StoryObj } from "@storybook/vue3";
import StatRow from "./StatRow.vue";

const meta = {
	title: "UI/Editorial/StatRow",
	component: StatRow,
	tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof StatRow>;

export const FourStat: Story = {
	render: () => ({
		components: { StatRow },
		setup: () => ({
			stats: [
				{ value: "339", label: "Lessons" },
				{ value: "42k", label: "Engineers" },
				{ value: "112", label: "Dispatches" },
				{ value: "2019", label: "Since" },
			],
		}),
		template: `<StatRow :stats="stats" />`,
	}),
};

export const FiveStatWithNotes: Story = {
	render: () => ({
		components: { StatRow },
		setup: () => ({
			stats: [
				{ value: "339", label: "Lessons", note: "Foundations → advanced" },
				{ value: "42k", label: "Engineers", note: "Actively subscribed" },
				{ value: "112", label: "Dispatches", note: "Weekly since 2023" },
				{ value: "84", label: "Technologies", note: "K8s, eBPF, Wasm, …" },
				{ value: "2019", label: "Since", note: "Still shipping" },
			],
		}),
		template: `<StatRow :stats="stats" />`,
	}),
};
