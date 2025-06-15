import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import SectionHeader from "./SectionHeader.vue";

const meta = {
	title: "Components/Common/SectionHeader",
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
		component: SectionHeader,
		props: {
			title: "Section Title",
		},
	},
};

export const WithoutSeparator: Story = {
	args: {
		component: SectionHeader,
		props: {
			title: "Section Without Separator",
			showSeparator: false,
		},
	},
};

export const LongTitle: Story = {
	args: {
		component: SectionHeader,
		props: {
			title:
				"This is a Very Long Section Title That Demonstrates How the Component Handles Extended Text",
		},
	},
};

export const MultipleExamples: Story = {
	args: {
		component: SectionHeader,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-12">
            <div>
              <SectionHeader title="Featured Articles" />
              <p class="text-gray-600 dark:text-gray-300">
                Explore our latest articles on cloud native technologies.
              </p>
            </div>
            
            <div>
              <SectionHeader title="Popular Courses" showSeparator={false} />
              <p class="text-gray-600 dark:text-gray-300">
                Browse through our most popular learning paths.
              </p>
            </div>
            
            <div>
              <SectionHeader title="Community Resources" />
              <p class="text-gray-600 dark:text-gray-300">
                Find helpful resources contributed by our community.
              </p>
            </div>
            
            <div>
              <SectionHeader title="Latest Videos" />
              <p class="text-gray-600 dark:text-gray-300">
                Watch our most recent educational content.
              </p>
            </div>
          </div>
        `,
				components: { SectionHeader },
			}}
		/>
	),
};

export const WithCustomClass: Story = {
	args: {
		component: SectionHeader,
		props: {
			title: "Custom Styled Header",
			class: "opacity-75",
		},
	},
};

export const InContext: Story = {
	args: {
		component: SectionHeader,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <section class="max-w-4xl mx-auto p-8">
            <SectionHeader title="Technologies" />
            
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">Kubernetes</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Container orchestration</p>
              </div>
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">Docker</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Container runtime</p>
              </div>
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">Terraform</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Infrastructure as code</p>
              </div>
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">Prometheus</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Monitoring & alerting</p>
              </div>
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">Istio</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Service mesh</p>
              </div>
              <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded">
                <h3 class="font-semibold">ArgoCD</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">GitOps deployment</p>
              </div>
            </div>
          </section>
        `,
				components: { SectionHeader },
			}}
		/>
	),
};
