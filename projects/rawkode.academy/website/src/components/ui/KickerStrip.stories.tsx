import type { StoryObj } from "@storybook/vue3";
import KickerStrip from "./KickerStrip.vue";

const meta = {
	title: "UI/Editorial/KickerStrip",
	component: KickerStrip,
	tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof KickerStrip>;

export const OnAir: Story = {
	render: () => ({
		components: { KickerStrip },
		template: `
			<KickerStrip
				:live="true"
				kicker="On air now"
				kicker-tone="amber"
				meta="— Tracing packets with eBPF · 1,284 watching"
				right="Dispatch №048 · Thursday 22:27"
			/>
		`,
	}),
};

export const HeavyMasthead: Story = {
	render: () => ({
		components: { KickerStrip },
		template: `
			<KickerStrip
				:heavy="true"
				kicker="Vol IV · §048"
				kicker-tone="ink"
				meta="Field notes from production"
				right="Thursday · April 23 2026"
			/>
		`,
	}),
};
