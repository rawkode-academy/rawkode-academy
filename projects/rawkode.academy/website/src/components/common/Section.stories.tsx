import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Heading from "./Heading.vue";
import Section from "./Section.vue";

const meta = {
	title: "Components/Common/Section",
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
		component: Section,
		props: {},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default:
					"This is the default section content with standard padding and container width.",
			}}
		/>
	),
};

export const AllPaddingSizes: Story = {
	args: {
		component: Section,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div>
            <Section padding="none" background="gray" class="border-b">
              <Heading size="lg">No Padding</Heading>
              <p>This section has no padding applied.</p>
            </Section>
            
            <Section padding="sm" background="gradient">
              <Heading size="lg">Small Padding</Heading>
              <p>This section has small padding (py-8 px-4).</p>
            </Section>
            
            <Section padding="md">
              <Heading size="lg">Medium Padding</Heading>
              <p>This section has medium padding (py-12 px-4).</p>
            </Section>
            
            <Section padding="lg" background="gray">
              <Heading size="lg">Large Padding (Default)</Heading>
              <p>This section has large padding (py-16 px-4 md:py-20).</p>
            </Section>
            
            <Section padding="xl" background="gradient">
              <Heading size="lg">Extra Large Padding</Heading>
              <p>This section has extra large padding (py-20 px-4 md:py-24 lg:py-32).</p>
            </Section>
          </div>
        `,
				components: { Section, Heading },
			}}
		/>
	),
};

export const AllContainerSizes: Story = {
	args: {
		component: Section,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div>
            <Section container="sm" background="gray">
              <Heading size="lg">Small Container</Heading>
              <p>This section has a small container (max-w-2xl).</p>
            </Section>
            
            <Section container="md">
              <Heading size="lg">Medium Container</Heading>
              <p>This section has a medium container (max-w-4xl).</p>
            </Section>
            
            <Section container="lg" background="gray">
              <Heading size="lg">Large Container</Heading>
              <p>This section has a large container (max-w-6xl).</p>
            </Section>
            
            <Section container="xl">
              <Heading size="lg">Extra Large Container (Default)</Heading>
              <p>This section has an extra large container (max-w-7xl).</p>
            </Section>
            
            <Section container="full" background="gray">
              <Heading size="lg">Full Width Container</Heading>
              <p>This section has a full width container.</p>
            </Section>
          </div>
        `,
				components: { Section, Heading },
			}}
		/>
	),
};

export const BackgroundVariants: Story = {
	args: {
		component: Section,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div>
            <Section background="none">
              <Heading size="lg">No Background</Heading>
              <p>This section has no background styling.</p>
            </Section>
            
            <Section background="gray">
              <Heading size="lg">Gray Background</Heading>
              <p>This section has a gray background with dark mode support.</p>
            </Section>
            
            <Section background="gradient">
              <Heading size="lg">Gradient Background</Heading>
              <p>This section has a gradient background from gray to white (dark mode aware).</p>
            </Section>
          </div>
        `,
				components: { Section, Heading },
			}}
		/>
	),
};

export const RealWorldExample: Story = {
	args: {
		component: Section,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div>
            <Section padding="xl" background="gradient">
              <div class="text-center mb-12">
                <Heading as="h1" size="4xl">Welcome to Our Platform</Heading>
                <p class="text-xl text-gray-600 dark:text-gray-300 mt-4">
                  Discover amazing features and capabilities
                </p>
              </div>
            </Section>
            
            <Section>
              <Heading as="h2" size="2xl" class="mb-6">Features</Heading>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <Heading as="h3" size="lg">Feature One</Heading>
                  <p class="mt-2 text-gray-600 dark:text-gray-300">
                    Description of the first feature goes here.
                  </p>
                </div>
                <div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <Heading as="h3" size="lg">Feature Two</Heading>
                  <p class="mt-2 text-gray-600 dark:text-gray-300">
                    Description of the second feature goes here.
                  </p>
                </div>
                <div class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <Heading as="h3" size="lg">Feature Three</Heading>
                  <p class="mt-2 text-gray-600 dark:text-gray-300">
                    Description of the third feature goes here.
                  </p>
                </div>
              </div>
            </Section>
            
            <Section padding="lg" background="gray">
              <div class="text-center">
                <Heading as="h2" size="2xl">Ready to Get Started?</Heading>
                <p class="text-lg text-gray-600 dark:text-gray-300 mt-4 mb-8">
                  Join thousands of users who are already benefiting from our platform.
                </p>
              </div>
            </Section>
          </div>
        `,
				components: { Section, Heading },
			}}
		/>
	),
};
