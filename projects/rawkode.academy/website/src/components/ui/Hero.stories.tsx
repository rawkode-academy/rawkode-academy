import type { StoryObj } from "@storybook/vue3";
import Hero from "./Hero.vue";
import Button from "../common/Button.vue";

const meta = {
	title: "UI/Hero",
	component: Hero,
	tags: ["autodocs"],
	argTypes: {
		layout: {
			control: "select",
			options: ["centered", "split", "full-width"],
			description: "Hero section layout style",
		},
		background: {
			control: "select",
			options: [
				"none",
				"gradient",
				"gradient-hero",
				"gradient-hero-alt",
				"blobs",
			],
			description: "Background style",
		},
		pattern: {
			control: "select",
			options: ["none", "grid", "dots"],
			description: "Background pattern overlay",
		},
		size: {
			control: "select",
			options: ["sm", "md", "lg", "xl"],
			description: "Vertical padding size",
		},
		align: {
			control: "select",
			options: ["left", "center", "right"],
			description: "Text alignment",
		},
		titleTag: {
			control: "select",
			options: ["h1", "h2", "h3"],
			description: "HTML heading tag for title",
		},
		titleSize: {
			control: "select",
			options: ["xl", "2xl", "3xl", "4xl"],
			description: "Title font size",
		},
		wave: {
			control: "boolean",
			description: "Show decorative wave at bottom",
		},
	},
};

export default meta;
type Story = StoryObj<typeof Hero>;

export const Default: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #title>
					Cloud Native & Kubernetes Education
				</template>
				<template #subtitle>
					Master Cloud Native technologies and Kubernetes with expert-led courses, articles, and live streams.
				</template>
				<template #actions>
					<Button variant="primary" size="lg">Get Started</Button>
					<Button variant="secondary" size="lg">Learn More</Button>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "gradient-hero",
		pattern: "grid",
		size: "lg",
		align: "center",
		titleTag: "h1",
		titleSize: "4xl",
		badge: "Free & Open Source",
		wave: false,
	},
};

export const WithBadge: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args" badge="New Course Available" badgeVariant="success">
				<template #title>
					Complete Guide to Zitadel
				</template>
				<template #subtitle>
					Master authentication and authorization with our comprehensive, hands-on course.
				</template>
				<template #actions>
					<Button variant="primary" size="lg">Start Learning</Button>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "gradient-hero",
		pattern: "grid",
		size: "lg",
		align: "center",
		titleTag: "h1",
		titleSize: "4xl",
	},
};

export const SplitLayout: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #badge>
					<span class="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-700 dark:text-green-300 font-medium">
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
						</svg>
						Free Course
					</span>
				</template>
				<template #title>
					Build Production-Ready Applications
				</template>
				<template #subtitle>
					Learn to build, deploy, and scale cloud-native applications with modern best practices.
				</template>
				<template #actions>
					<Button variant="primary" size="lg">
						Start Learning Now
						<template #icon-right>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
							</svg>
						</template>
					</Button>
				</template>
				<template #stats>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
							<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
							</svg>
						</div>
						<div>
							<div class="text-primary-content font-semibold">12 Modules</div>
							<div class="text-xs">Comprehensive content</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
							<svg class="w-5 h-5 text-secondary dark:text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
							</svg>
						</div>
						<div>
							<div class="text-primary-content font-semibold">Beginner</div>
							<div class="text-xs">Level</div>
						</div>
					</div>
				</template>
				<template #media>
					<div class="relative">
						<div class="absolute -top-4 -right-4 w-72 h-72 bg-yellow-500 dark:bg-yellow-500 rounded-full opacity-5 blur-3xl"></div>
						<div class="relative glass-card rounded-2xl p-8">
							<div class="w-20 h-20 bg-gradient-secondary rounded-2xl flex items-center justify-center mb-6 mx-auto">
								<svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
								</svg>
							</div>
							<h3 class="text-2xl font-bold text-primary-content mb-4 text-center">Course Preview</h3>
							<p class="text-secondary-content text-center">
								Interactive hands-on learning with real-world examples and projects.
							</p>
						</div>
					</div>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "split",
		background: "gradient-hero",
		pattern: "none",
		size: "lg",
		align: "left",
		titleTag: "h1",
		titleSize: "4xl",
	},
};

export const LeftAligned: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #title>
					Platform Engineering Made Simple
				</template>
				<template #subtitle>
					Build internal developer platforms that your team will love to use.
				</template>
				<template #actions>
					<Button variant="primary" size="lg">Explore Courses</Button>
					<Button variant="ghost" size="lg">View Documentation</Button>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "gradient-hero-alt",
		pattern: "dots",
		size: "lg",
		align: "left",
		titleTag: "h1",
		titleSize: "3xl",
	},
};

export const WithWave: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #title>
					Join Our Community
				</template>
				<template #subtitle>
					Connect with thousands of developers learning cloud native technologies together.
				</template>
				<template #actions>
					<Button variant="primary" size="lg">Join Discord</Button>
					<Button variant="secondary" size="lg">Follow on GitHub</Button>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "blobs",
		pattern: "none",
		size: "md",
		align: "center",
		titleTag: "h2",
		titleSize: "3xl",
		wave: true,
	},
};

export const CompactSize: Story = {
	render: (args) => ({
		components: { Hero },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #breadcrumb>
					<nav class="flex items-center gap-2 text-sm text-muted">
						<a href="/" class="hover:text-primary-content">Home</a>
						<span>/</span>
						<a href="/courses" class="hover:text-primary-content">Courses</a>
						<span>/</span>
						<span class="text-primary-content">Current Course</span>
					</nav>
				</template>
				<template #title>
					Course Detail Page
				</template>
				<template #subtitle>
					A more compact hero for internal pages.
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "gradient-hero-alt",
		pattern: "none",
		size: "sm",
		align: "center",
		titleTag: "h1",
		titleSize: "2xl",
	},
};

export const NoBackground: Story = {
	render: (args) => ({
		components: { Hero, Button },
		setup() {
			return { args };
		},
		template: `
			<Hero v-bind="args">
				<template #title>
					Minimal Hero Section
				</template>
				<template #subtitle>
					Sometimes less is more. A clean, minimal hero without background effects.
				</template>
				<template #actions>
					<Button variant="primary">Get Started</Button>
				</template>
			</Hero>
		`,
	}),
	args: {
		layout: "centered",
		background: "none",
		pattern: "none",
		size: "md",
		align: "center",
		titleTag: "h1",
		titleSize: "3xl",
	},
};
