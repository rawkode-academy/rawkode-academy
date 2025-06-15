import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Button from "./Button.vue";
import Heading from "./Heading.vue";
import HeroSection from "./HeroSection.vue";

const meta = {
	title: "Components/Common/HeroSection",
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
		component: HeroSection,
		props: {},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <HeroSection v-bind="props">
            <div class="text-center max-w-3xl mx-auto">
              <Heading as="h1" size="4xl" align="center" class="mb-6">
                Welcome to Our Platform
              </Heading>
              <p class="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Discover amazing features and capabilities that will transform your workflow.
              </p>
              <div class="flex gap-4 justify-center">
                <Button variant="primary" size="lg">Get Started</Button>
                <Button variant="secondary" size="lg">Learn More</Button>
              </div>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading, Button },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const CustomGradient: Story = {
	args: {
		component: HeroSection,
		props: {
			gradientFrom: "from-blue-100",
			gradientVia: "via-purple-50",
			gradientTo: "to-pink-100",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <HeroSection v-bind="props">
            <div class="text-center max-w-3xl mx-auto">
              <Heading as="h1" size="4xl" align="center" class="mb-6">
                Custom Gradient Hero
              </Heading>
              <p class="text-xl text-gray-600 dark:text-gray-300">
                This hero section uses a custom gradient background.
              </p>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const WithBackgroundPattern: Story = {
	args: {
		component: HeroSection,
		props: {},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <HeroSection v-bind="props">
            <template #background>
              <div class="absolute inset-0 opacity-10">
                <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" stroke-width="1"/>
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            </template>
            <div class="text-center max-w-3xl mx-auto">
              <Heading as="h1" size="4xl" align="center" class="mb-6">
                Hero with Background Pattern
              </Heading>
              <p class="text-xl text-gray-600 dark:text-gray-300">
                This example includes a subtle grid pattern in the background.
              </p>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const LeftAligned: Story = {
	args: {
		component: HeroSection,
		props: {},
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <HeroSection>
            <div class="max-w-4xl">
              <Heading as="h1" size="4xl" class="mb-6">
                Build Better Software
              </Heading>
              <p class="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl">
                Join thousands of developers who are building amazing applications with our platform.
                Get started today and see the difference.
              </p>
              <div class="flex gap-4">
                <Button variant="primary" size="lg">Start Free Trial</Button>
                <Button variant="ghost" size="lg">View Documentation</Button>
              </div>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading, Button },
			}}
		/>
	),
};

export const WithStats: Story = {
	args: {
		component: HeroSection,
		props: {},
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <HeroSection>
            <div class="text-center max-w-4xl mx-auto">
              <Heading as="h1" size="4xl" align="center" class="mb-6">
                Trusted by Developers Worldwide
              </Heading>
              <p class="text-xl text-gray-600 dark:text-gray-300 mb-12">
                Join the community of developers building the future.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div>
                  <div class="text-4xl font-bold text-primary mb-2">10K+</div>
                  <div class="text-gray-600 dark:text-gray-400">Active Users</div>
                </div>
                <div>
                  <div class="text-4xl font-bold text-primary mb-2">500+</div>
                  <div class="text-gray-600 dark:text-gray-400">Projects Built</div>
                </div>
                <div>
                  <div class="text-4xl font-bold text-primary mb-2">99.9%</div>
                  <div class="text-gray-600 dark:text-gray-400">Uptime SLA</div>
                </div>
              </div>
              <Button variant="primary" size="lg">Get Started Now</Button>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading, Button },
			}}
		/>
	),
};

export const WithImage: Story = {
	args: {
		component: HeroSection,
		props: {
			class: "py-24",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <HeroSection v-bind="props">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <Heading as="h1" size="4xl" class="mb-6">
                  Modern Development Platform
                </Heading>
                <p class="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  Everything you need to build, deploy, and scale your applications.
                  Start with our powerful tools and intuitive interface.
                </p>
                <div class="flex gap-4">
                  <Button variant="primary" size="lg">Try for Free</Button>
                  <Button variant="secondary" size="lg">Schedule Demo</Button>
                </div>
              </div>
              <div class="relative">
                <div class="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg shadow-xl flex items-center justify-center">
                  <span class="text-gray-400">Hero Image Placeholder</span>
                </div>
              </div>
            </div>
          </HeroSection>
        `,
				components: { HeroSection, Heading, Button },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};
