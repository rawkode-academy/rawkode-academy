import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import GridLayout from "./GridLayout.vue";

const meta = {
	title: "Components/Common/GridLayout",
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
		component: GridLayout,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <GridLayout :cols="{ default: 1, md: 2, lg: 3 }" :gap="6">
            <div class="bg-primary/10 p-6 rounded-lg">Item 1</div>
            <div class="bg-secondary/10 p-6 rounded-lg">Item 2</div>
            <div class="bg-tertiary/10 p-6 rounded-lg">Item 3</div>
            <div class="bg-primary/10 p-6 rounded-lg">Item 4</div>
            <div class="bg-secondary/10 p-6 rounded-lg">Item 5</div>
            <div class="bg-tertiary/10 p-6 rounded-lg">Item 6</div>
          </GridLayout>
        `,
				components: { GridLayout },
			}}
		/>
	),
};

export const ResponsiveColumns: Story = {
	args: {
		component: GridLayout,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-8">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">1 column on mobile, 2 on tablet, 4 on desktop</h3>
              <GridLayout :cols="{ default: 1, md: 2, lg: 4 }" :gap="4">
                <div v-for="i in 8" :key="i" class="bg-gray-100 dark:bg-gray-700 p-4 rounded text-center">
                  {{ i }}
                </div>
              </GridLayout>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">2 columns on mobile, 3 on tablet, 5 on desktop</h3>
              <GridLayout :cols="{ default: 2, md: 3, lg: 5 }" :gap="6">
                <div v-for="i in 10" :key="i" class="bg-gray-100 dark:bg-gray-700 p-4 rounded text-center">
                  {{ i }}
                </div>
              </GridLayout>
            </div>
          </div>
        `,
				components: { GridLayout },
			}}
		/>
	),
};

export const DifferentGaps: Story = {
	args: {
		component: GridLayout,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-8">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gap: 2</h3>
              <GridLayout :cols="{ default: 3 }" :gap="2">
                <div v-for="i in 6" :key="i" class="bg-primary/20 p-4 rounded">{{ i }}</div>
              </GridLayout>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gap: 6</h3>
              <GridLayout :cols="{ default: 3 }" :gap="6">
                <div v-for="i in 6" :key="i" class="bg-secondary/20 p-4 rounded">{{ i }}</div>
              </GridLayout>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gap: 12</h3>
              <GridLayout :cols="{ default: 3 }" :gap="12">
                <div v-for="i in 6" :key="i" class="bg-tertiary/20 p-4 rounded">{{ i }}</div>
              </GridLayout>
            </div>
          </div>
        `,
				components: { GridLayout },
			}}
		/>
	),
};

export const CardGrid: Story = {
	args: {
		component: GridLayout,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <GridLayout :cols="{ default: 1, md: 2, lg: 3 }" :gap="6">
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 1</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the first feature goes here.</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 2</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the second feature goes here.</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 3</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the third feature goes here.</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 4</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the fourth feature goes here.</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 5</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the fifth feature goes here.</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feature 6</h3>
              <p class="text-gray-600 dark:text-gray-300">Description of the sixth feature goes here.</p>
            </div>
          </GridLayout>
        `,
				components: { GridLayout },
			}}
		/>
	),
};

export const AlignmentOptions: Story = {
	args: {
		component: GridLayout,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-8">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Align: start</h3>
              <GridLayout :cols="{ default: 3 }" :gap="4" align="start">
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-20">Short</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-32">Tall</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-24">Medium</div>
              </GridLayout>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Align: center</h3>
              <GridLayout :cols="{ default: 3 }" :gap="4" align="center">
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-20">Short</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-32">Tall</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-24">Medium</div>
              </GridLayout>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Align: end</h3>
              <GridLayout :cols="{ default: 3 }" :gap="4" align="end">
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-20">Short</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-32">Tall</div>
                <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded h-24">Medium</div>
              </GridLayout>
            </div>
          </div>
        `,
				components: { GridLayout },
			}}
		/>
	),
};
