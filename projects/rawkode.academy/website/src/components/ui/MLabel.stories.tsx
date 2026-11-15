import type { Meta, StoryObj } from "@storybook/react";
import { defineComponent, h } from "vue";
import { VueInReact } from "../vue-wrapper";
import MLabel from "./MLabel.vue";

const meta = {
	title: "Components/UI/MLabel",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const tones = [
	"muted",
	"soft",
	"ink",
	"accent",
	"amber",
	"rust",
	"spruce",
] as const;

const DefaultSpecimen = defineComponent({
	setup: () => () => h(MLabel, { tone: "muted" }, () => "Articles"),
});

const TonesSpecimen = defineComponent({
	setup: () => () =>
		h(
			"div",
			{ style: "display:flex;flex-direction:column;gap:0.75rem" },
			tones.map((tone) => h(MLabel, { tone }, () => `Tone ${tone}`)),
		),
});

export const Default: Story = {
	render: () => <VueInReact component={DefaultSpecimen} />,
};

export const Tones: Story = {
	render: () => <VueInReact component={TonesSpecimen} />,
};
