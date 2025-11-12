import type { StoryObj } from "@storybook/vue3";
import Card from "./Card.vue";
import Badge from "../common/Badge.vue";

const meta = {
	title: "UI/Card",
	component: Card,
	tags: ["autodocs"],
	argTypes: {
		variant: {
			control: "select",
			options: ["glass", "solid", "gradient", "bordered", "flat"],
			description: "Visual style variant of the card",
		},
		padding: {
			control: "select",
			options: ["none", "sm", "md", "lg"],
			description: "Internal padding of the card content",
		},
		rounded: {
			control: "select",
			options: ["none", "sm", "md", "lg", "xl", "2xl", "3xl"],
			description: "Border radius of the card",
		},
		shadow: {
			control: "select",
			options: ["none", "sm", "md", "lg", "elevated"],
			description: "Shadow depth of the card",
		},
		hover: {
			control: "boolean",
			description: "Enable hover effects (scale, shadow, background)",
		},
		href: {
			control: "text",
			description: "If provided, renders card as an anchor link",
		},
	},
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Card Title</h3>
				<p class="text-secondary-content">
					This is a default card with glass morphism effect. It includes hover animations and a beautiful glassmorphic background.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};

export const WithBadge: Story = {
	render: (args) => ({
		components: { Card, Badge },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<template #badge>
					<Badge variant="primary" size="sm">Featured</Badge>
				</template>
				<h3 class="text-xl font-bold text-primary-content mb-2">Featured Card</h3>
				<p class="text-secondary-content">
					This card has a badge in the top-left corner.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};

export const WithMediaAndFooter: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<template #media>
					<img
						src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/blog/office-laptops.png"
						alt="Example"
						class="w-full h-52 object-cover"
					/>
				</template>
				<template #overlay>
					<div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
				</template>
				<h3 class="text-xl font-bold text-primary-content mb-2">Card with Media</h3>
				<p class="text-secondary-content">
					This card includes an image with a gradient overlay and a footer section.
				</p>
				<template #footer>
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted">Author Name</span>
						<span class="text-sm text-muted">Dec 12, 2024</span>
					</div>
				</template>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};

export const SolidVariant: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Solid Card</h3>
				<p class="text-secondary-content">
					A solid background variant without transparency effects.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "solid",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};

export const GradientVariant: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Gradient Card</h3>
				<p class="text-secondary-content">
					A card with a gradient background overlay.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "gradient",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};

export const BorderedVariant: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Bordered Card</h3>
				<p class="text-secondary-content">
					A transparent card with only borders visible.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "bordered",
		padding: "md",
		rounded: "xl",
		shadow: "none",
		hover: true,
	},
};

export const AsLink: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Clickable Card</h3>
				<p class="text-secondary-content">
					This card is rendered as a link and navigates when clicked.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
		href: "https://rawkode.academy",
	},
};

export const NoHover: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h3 class="text-xl font-bold text-primary-content mb-2">Static Card</h3>
				<p class="text-secondary-content">
					This card has no hover effects enabled.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: false,
	},
};

export const CompactSize: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h4 class="text-lg font-semibold text-primary-content mb-1">Compact Card</h4>
				<p class="text-sm text-secondary-content">
					Smaller padding and rounded corners.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "sm",
		rounded: "lg",
		shadow: "sm",
		hover: true,
	},
};

export const LargeSize: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<Card v-bind="args">
				<h2 class="text-2xl font-bold text-primary-content mb-4">Large Card</h2>
				<p class="text-lg text-secondary-content">
					Generous padding and extra rounded corners for a more spacious feel.
				</p>
			</Card>
		`,
	}),
	args: {
		variant: "glass",
		padding: "lg",
		rounded: "3xl",
		shadow: "elevated",
		hover: true,
	},
};

export const Grid: Story = {
	render: (args) => ({
		components: { Card },
		setup() {
			return { args };
		},
		template: `
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<Card v-bind="args">
					<h3 class="text-xl font-bold text-primary-content mb-2">Card 1</h3>
					<p class="text-secondary-content">First card in a grid layout.</p>
				</Card>
				<Card v-bind="args">
					<h3 class="text-xl font-bold text-primary-content mb-2">Card 2</h3>
					<p class="text-secondary-content">Second card in a grid layout.</p>
				</Card>
				<Card v-bind="args">
					<h3 class="text-xl font-bold text-primary-content mb-2">Card 3</h3>
					<p class="text-secondary-content">Third card in a grid layout.</p>
				</Card>
			</div>
		`,
	}),
	args: {
		variant: "glass",
		padding: "md",
		rounded: "xl",
		shadow: "md",
		hover: true,
	},
};
