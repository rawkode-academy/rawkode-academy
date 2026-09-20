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
				right="Thursday · 22:27 UTC"
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
				kicker="Articles"
				kicker-tone="ink"
				meta="Cloud native tutorials"
				right="Thursday · April 23 2026"
			/>
		`,
	}),
};
