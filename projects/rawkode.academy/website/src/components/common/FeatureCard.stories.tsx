import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Button from "./Button.vue";
import FeatureCard from "./FeatureCard.vue";

const meta = {
	title: "Components/Common/FeatureCard",
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
		component: FeatureCard,
		props: {
			title: "Feature Title",
			description:
				"This is a description of an amazing feature that provides value to users.",
		},
	},
};

export const WithIcon: Story = {
	args: {
		component: FeatureCard,
		props: {
			title: "Cloud Native",
			description: "Learn modern cloud native technologies and best practices.",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <FeatureCard v-bind="props">
            <template #icon>
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </template>
          </FeatureCard>
        `,
				components: { FeatureCard },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const WithCustomIconBackground: Story = {
	args: {
		component: FeatureCard,
		props: {
			title: "Security First",
			description: "Built with security best practices from the ground up.",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <FeatureCard v-bind="props">
            <template #icon>
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </template>
          </FeatureCard>
        `,
				components: { FeatureCard },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const WithFooter: Story = {
	args: {
		component: FeatureCard,
		props: {
			title: "Get Started",
			description:
				"Ready to begin your learning journey? Start with our beginner-friendly courses.",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <FeatureCard v-bind="props">
            <template #icon>
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </template>
            <template #footer>
              <Button variant="primary" size="sm">Start Learning</Button>
            </template>
          </FeatureCard>
        `,
				components: { FeatureCard, Button },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const FeatureGrid: Story = {
	args: {
		component: FeatureCard,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              title="Interactive Learning"
              description="Hands-on exercises and real-world projects to reinforce your learning."
              iconBgColor="bg-blue-100 dark:bg-blue-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </template>
            </FeatureCard>
            
            <FeatureCard
              title="Expert Instructors"
              description="Learn from industry professionals with years of real-world experience."
              iconBgColor="bg-green-100 dark:bg-green-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </template>
            </FeatureCard>
            
            <FeatureCard
              title="Community Support"
              description="Join a vibrant community of learners and get help when you need it."
              iconBgColor="bg-purple-100 dark:bg-purple-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </template>
            </FeatureCard>
            
            <FeatureCard
              title="Flexible Schedule"
              description="Learn at your own pace with 24/7 access to all course materials."
              iconBgColor="bg-orange-100 dark:bg-orange-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </template>
            </FeatureCard>
            
            <FeatureCard
              title="Certificates"
              description="Earn recognized certificates upon successful completion of courses."
              iconBgColor="bg-indigo-100 dark:bg-indigo-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </template>
            </FeatureCard>
            
            <FeatureCard
              title="Regular Updates"
              description="Course content is regularly updated to reflect the latest industry trends."
              iconBgColor="bg-pink-100 dark:bg-pink-900/20"
            >
              <template #icon>
                <svg class="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </template>
            </FeatureCard>
          </div>
        `,
				components: { FeatureCard },
			}}
		/>
	),
};
