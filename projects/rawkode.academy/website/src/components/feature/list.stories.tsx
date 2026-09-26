import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import FeatureList from "./list.vue";

const meta = {
	title: "Components/Feature/List",
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
		component: FeatureList,
		props: {
			title: "Our Key Features",
			description:
				"Everything you need to build modern applications with confidence and speed",
			segments: [
				{
					title: "Fast Development",
					description:
						"Build applications quickly with our optimized development workflow and tools.",
					emoji: "🚀",
				},
				{
					title: "Secure by Default",
					description:
						"Enterprise-grade security built into every component and feature.",
					emoji: "🔒",
				},
				{
					title: "Scalable Architecture",
					description:
						"Start small and scale to millions of users with our flexible infrastructure.",
					emoji: "📈",
				},
				{
					title: "Modern Stack",
					description:
						"Build applications with cloud native tools and frameworks.",
					emoji: "💻",
				},
				{
					title: "Great Developer Experience",
					description:
						"Enjoy a smooth development process with excellent tooling and documentation.",
					emoji: "👨‍💻",
				},
				{
					title: "24/7 Support",
					description:
						"Get help whenever you need it with our round-the-clock support team.",
					emoji: "🤝",
				},
			],
		},
	},
};

export const MinimalFeatures: Story = {
	args: {
		component: FeatureList,
		props: {
			title: "Simple Features",
			description: "A minimal set of features to get started",
			segments: [
				{
					title: "Easy Setup",
					description: "Get up and running in minutes.",
					emoji: "⚡",
				},
				{
					title: "Documentation",
					description: "Comprehensive guides and API references.",
					emoji: "📚",
				},
				{
					title: "Community",
					description: "Join thousands of developers building amazing things.",
					emoji: "👥",
				},
			],
		},
	},
};
