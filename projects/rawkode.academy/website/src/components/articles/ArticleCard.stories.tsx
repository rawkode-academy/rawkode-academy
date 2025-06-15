import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import ArticleCard from "./ArticleCard.vue";

const meta = {
	title: "Components/Articles/ArticleCard",
	component: VueInReact,
	parameters: {
		layout: "padded",
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

const sampleAuthors = [
	{ name: "David McKay", handle: "rawkode" },
	{ name: "Jane Smith", handle: "janesmith" },
];

export const Default: Story = {
	args: {
		component: ArticleCard,
		props: {
			id: "getting-started-with-kubernetes",
			title: "Getting Started with Kubernetes",
			subtitle:
				"Learn the fundamentals of container orchestration with this comprehensive guide to Kubernetes",
			cover: {
				image:
					"https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80",
				alt: "Kubernetes container orchestration",
			},
			authors: sampleAuthors,
			publishedAt: new Date("2024-01-15"),
		},
	},
};

export const WithoutCover: Story = {
	args: {
		component: ArticleCard,
		props: {
			id: "cloud-native-best-practices",
			title: "Cloud Native Best Practices",
			subtitle:
				"Essential patterns and practices for building scalable cloud native applications",
			authors: [sampleAuthors[0]],
			publishedAt: new Date("2024-02-01"),
		},
	},
};

export const MultipleAuthors: Story = {
	args: {
		component: ArticleCard,
		props: {
			id: "microservices-architecture",
			title: "Building Microservices with Go",
			subtitle:
				"A practical guide to designing and implementing microservices architecture",
			cover: {
				image:
					"https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80",
				alt: "Microservices architecture diagram",
			},
			authors: [
				{ name: "David McKay", handle: "rawkode" },
				{ name: "Alice Johnson", handle: "alicej" },
				{ name: "Bob Williams", handle: "bobw" },
				{ name: "Carol Davis", handle: "carold" },
				{ name: "Eve Martinez", handle: "evem" },
			],
			publishedAt: new Date("2024-03-10"),
		},
	},
};

export const LongTitle: Story = {
	args: {
		component: ArticleCard,
		props: {
			id: "comprehensive-guide-kubernetes",
			title:
				"A Comprehensive Guide to Kubernetes: From Basic Concepts to Advanced Deployment Strategies in Production Environments",
			subtitle:
				"Everything you need to know about container orchestration, scaling, and maintaining cloud native applications",
			cover: {
				image:
					"https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1200&q=80",
				alt: "Cloud infrastructure",
			},
			authors: sampleAuthors,
			publishedAt: new Date("2023-12-20"),
		},
	},
};
