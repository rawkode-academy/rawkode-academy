import type { Meta, StoryObj } from "@storybook/react";
import Typewriter from "./typewriter";

const meta = {
	title: "Components/Hero/Typewriter",
	component: Typewriter,
	parameters: {
		layout: "fullscreen",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof Typewriter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		rotatedPrefixes: [
			"Learn Cloud Native",
			"Master Kubernetes",
			"Deploy with Confidence",
			"Build Better Systems",
		],
		suffix: "with Rawkode Academy",
		highlight: "Rawkode Academy",
		logos: [
			{
				name: "Kubernetes",
				iconUrl:
					"https://content.rawkode.academy/logos/technologies/kubernetes/icon.svg",
			},
			{
				name: "Docker",
				iconUrl:
					"https://content.rawkode.academy/logos/technologies/docker/icon.svg",
			},
			{
				name: "Cilium",
				iconUrl:
					"https://content.rawkode.academy/logos/technologies/cilium/icon.svg",
			},
			{
				name: "FluxCD",
				iconUrl:
					"https://content.rawkode.academy/logos/technologies/fluxcd/icon.svg",
			},
		],
		primaryButton: {
			text: "Get Started",
			link: "/courses",
		},
		secondaryButton: {
			text: "Watch Videos",
			link: "/watch",
		},
	},
};

export const CustomHighlight: Story = {
	args: {
		...Default.args,
		suffix: "and become a Cloud Native expert",
		highlight: "Cloud Native",
	},
};

export const WithExternalLinks: Story = {
	args: {
		...Default.args,
		primaryButton: {
			text: "Join Discord",
			link: "https://discord.gg/rawkode",
			newWindow: true,
		},
		secondaryButton: {
			text: "View GitHub",
			link: "https://github.com/rawkodeacademy",
			newWindow: true,
		},
	},
};
