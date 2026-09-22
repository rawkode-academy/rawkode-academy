import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import TestimonialSlider from "./slider.vue";

const meta = {
	title: "Components/Testimonial/Slider",
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

const sampleTestimonials = [
	{
		quote:
			"Example feedback: I followed the Kubernetes exercises and tried the commands in my own cluster.",
		author: {
			name: "Sarah Johnson",
			title: "Senior DevOps Engineer",
			image:
				"https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
			link: "https://linkedin.com/in/sarahjohnson",
		},
	},
	{
		quote:
			"Example feedback: I use the articles and videos when learning a new cloud native tool.",
		author: {
			name: "Michael Chen",
			title: "Platform Architect",
			image:
				"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
		},
	},
	{
		quote:
			"Example feedback: The code examples helped me test the approach in my own project.",
		author: {
			name: "Emily Rodriguez",
			title: "Cloud Solutions Architect",
			image:
				"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
			link: "https://twitter.com/emilyrodriguez",
		},
	},
];

export const Default: Story = {
	args: {
		component: TestimonialSlider,
		props: {
			testimonials: sampleTestimonials,
		},
	},
};

export const SingleTestimonial: Story = {
	args: {
		component: TestimonialSlider,
		props: {
			testimonials: [sampleTestimonials[0]],
		},
	},
};

export const WithoutLinks: Story = {
	args: {
		component: TestimonialSlider,
		props: {
			testimonials: [
				{
					quote:
						"Example feedback: I learned how to configure and troubleshoot Kubernetes workloads.",
					author: {
						name: "Alex Thompson",
						title: "Infrastructure Engineer",
						image:
							"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
					},
				},
				{
					quote:
						"Example feedback: I asked a question in the community and got help with my configuration.",
					author: {
						name: "Jessica Martinez",
						title: "SRE Manager",
						image:
							"https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
					},
				},
			],
		},
	},
};
