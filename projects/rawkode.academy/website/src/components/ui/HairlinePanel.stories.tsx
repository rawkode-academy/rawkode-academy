import type { StoryObj } from "@storybook/vue3";
import HairlinePanel from "./HairlinePanel.vue";

const meta = {
	title: "UI/Editorial/HairlinePanel",
	component: HairlinePanel,
	tags: ["autodocs"],
	argTypes: {
		variant: {
			control: "select",
			options: ["paper", "paper-deep", "muted", "ink"],
		},
		heavy: { control: "boolean" },
	},
};
export default meta;
type Story = StoryObj<typeof HairlinePanel>;

export const Default: Story = {
	render: (args) => ({
		components: { HairlinePanel },
		setup: () => ({ args }),
		template: `
			<HairlinePanel v-bind="args" style="padding:1.5rem;max-width:480px">
				<h3>A panel</h3>
				<p style="margin:0.5rem 0 0">Hairline-bordered paper surface for editorial blocks.</p>
			</HairlinePanel>
		`,
	}),
	args: { variant: "paper-deep", heavy: false },
};
