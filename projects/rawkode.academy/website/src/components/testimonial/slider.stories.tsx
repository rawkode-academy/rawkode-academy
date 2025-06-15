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
			"The cloud native courses at Rawkode Academy transformed my career. The hands-on approach and expert guidance made complex concepts easy to understand.",
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
			"I've been following Rawkode for years. The quality of content and community support is unmatched. Highly recommend for anyone serious about cloud technologies.",
		author: {
			name: "Michael Chen",
			title: "Platform Architect",
			image:
				"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
		},
	},
	{
		quote:
			"From beginner to advanced topics, Rawkode Academy covers it all. The real-world examples and practical exercises helped me implement solutions at scale.",
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
						"An amazing learning experience that helped me master Kubernetes and cloud native practices.",
					author: {
						name: "Alex Thompson",
						title: "Infrastructure Engineer",
						image:
							"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80",
					},
				},
				{
					quote:
						"The community is incredibly supportive and the content is always cutting-edge.",
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
