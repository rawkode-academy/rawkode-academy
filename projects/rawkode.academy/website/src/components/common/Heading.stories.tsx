import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Heading from "./Heading.vue";

const meta = {
	title: "Components/Common/Heading",
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

export const Default: Story = {
	args: {
		component: Heading,
		props: {},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Default Heading",
			}}
		/>
	),
};

export const AllSizes: Story = {
	args: {
		component: Heading,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <Heading size="xs">Extra Small Heading</Heading>
            <Heading size="sm">Small Heading</Heading>
            <Heading size="md">Medium Heading</Heading>
            <Heading size="lg">Large Heading</Heading>
            <Heading size="xl">Extra Large Heading</Heading>
            <Heading size="2xl">2XL Heading</Heading>
            <Heading size="3xl">3XL Heading</Heading>
            <Heading size="4xl">4XL Heading</Heading>
          </div>
        `,
				components: { Heading },
			}}
		/>
	),
};

export const AllTags: Story = {
	args: {
		component: Heading,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <Heading as="h1">H1: Page Title</Heading>
            <Heading as="h2">H2: Section Title</Heading>
            <Heading as="h3">H3: Subsection Title</Heading>
            <Heading as="h4">H4: Card Title</Heading>
            <Heading as="h5">H5: Small Title</Heading>
            <Heading as="h6">H6: Tiny Title</Heading>
          </div>
        `,
				components: { Heading },
			}}
		/>
	),
};

export const Alignments: Story = {
	args: {
		component: Heading,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <Heading align="left">Left Aligned Heading</Heading>
            <Heading align="center">Center Aligned Heading</Heading>
            <Heading align="right">Right Aligned Heading</Heading>
          </div>
        `,
				components: { Heading },
			}}
		/>
	),
};

export const Weights: Story = {
	args: {
		component: Heading,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <Heading weight="normal">Normal Weight Heading</Heading>
            <Heading weight="medium">Medium Weight Heading</Heading>
            <Heading weight="semibold">Semibold Weight Heading</Heading>
            <Heading weight="bold">Bold Weight Heading</Heading>
            <Heading weight="extrabold">Extrabold Weight Heading</Heading>
          </div>
        `,
				components: { Heading },
			}}
		/>
	),
};

export const PageExample: Story = {
	args: {
		component: Heading,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-8">
            <Heading as="h1" size="4xl" align="center">Welcome to Rawkode Academy</Heading>
            <Heading as="h2" size="xl" weight="medium" align="center">Learn Cloud Native Technologies</Heading>
            <div class="mt-12 space-y-6">
              <Heading as="h3">Featured Courses</Heading>
              <p class="text-gray-600 dark:text-gray-300">Explore our comprehensive courses on Kubernetes, cloud engineering, and more.</p>
            </div>
          </div>
        `,
				components: { Heading },
			}}
		/>
	),
};
