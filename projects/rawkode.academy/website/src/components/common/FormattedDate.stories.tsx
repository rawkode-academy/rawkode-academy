import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import FormattedDate from "./FormattedDate.vue";

const meta = {
	title: "Components/Common/FormattedDate",
	component: VueInReact,
	parameters: {
		layout: "centered",
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

const testDate = new Date("2024-03-15T10:30:00");

export const Default: Story = {
	args: {
		component: FormattedDate,
		props: {
			date: testDate,
		},
	},
};

export const ShortFormat: Story = {
	args: {
		component: FormattedDate,
		props: {
			date: testDate,
			format: "short",
		},
	},
};

export const LongFormat: Story = {
	args: {
		component: FormattedDate,
		props: {
			date: testDate,
			format: "long",
		},
	},
};

export const FullFormat: Story = {
	args: {
		component: FormattedDate,
		props: {
			date: testDate,
			format: "full",
		},
	},
};

export const WithIcon: Story = {
	args: {
		component: FormattedDate,
		props: {
			date: testDate,
			showIcon: true,
		},
	},
};

export const AllVariants: Story = {
	args: {
		component: FormattedDate,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Short Format</h3>
              <FormattedDate :date="date" format="short" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Long Format</h3>
              <FormattedDate :date="date" format="long" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Full Format</h3>
              <FormattedDate :date="date" format="full" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">With Icon</h3>
              <FormattedDate :date="date" showIcon />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Long Format with Icon</h3>
              <FormattedDate :date="date" format="long" showIcon />
            </div>
          </div>
        `,
				components: { FormattedDate },
				setup() {
					return {
						date: new Date("2024-03-15T10:30:00"),
					};
				},
			}}
		/>
	),
};

export const DifferentDates: Story = {
	args: {
		component: FormattedDate,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-2">
            <FormattedDate :date="today" showIcon />
            <FormattedDate :date="yesterday" showIcon />
            <FormattedDate :date="lastWeek" showIcon />
            <FormattedDate :date="lastMonth" showIcon />
            <FormattedDate :date="lastYear" showIcon />
          </div>
        `,
				components: { FormattedDate },
				setup() {
					const today = new Date();
					const yesterday = new Date();
					yesterday.setDate(yesterday.getDate() - 1);
					const lastWeek = new Date();
					lastWeek.setDate(lastWeek.getDate() - 7);
					const lastMonth = new Date();
					lastMonth.setMonth(lastMonth.getMonth() - 1);
					const lastYear = new Date();
					lastYear.setFullYear(lastYear.getFullYear() - 1);

					return {
						today,
						yesterday,
						lastWeek,
						lastMonth,
						lastYear,
					};
				},
			}}
		/>
	),
};

export const InContext: Story = {
	args: {
		component: FormattedDate,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <article class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 class="text-xl font-bold mb-2">Understanding Kubernetes Deployments</h2>
            <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>By John Doe</span>
              <span>•</span>
              <FormattedDate :date="publishDate" />
              <span>•</span>
              <span>5 min read</span>
            </div>
            <p class="mt-4 text-gray-700 dark:text-gray-300">
              Learn how to effectively manage and scale your applications using Kubernetes deployments...
            </p>
          </article>
        `,
				components: { FormattedDate },
				setup() {
					return {
						publishDate: new Date("2024-03-10"),
					};
				},
			}}
		/>
	),
};
