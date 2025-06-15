import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Badge from "./Badge.vue";

const meta = {
	title: "Components/Common/Badge",
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

export const Default: Story = {
	args: {
		component: Badge,
		props: {
			variant: "default",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Default Badge",
			}}
		/>
	),
};

export const AllVariants: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex flex-wrap gap-4">
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="tertiary">Tertiary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const AllSizes: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex items-center gap-4">
            <Badge size="xs" variant="primary">Extra Small</Badge>
            <Badge size="sm" variant="primary">Small</Badge>
            <Badge size="md" variant="primary">Medium</Badge>
            <Badge size="lg" variant="primary">Large</Badge>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const OutlineVariants: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex flex-wrap gap-4">
            <Badge variant="default" :outline="true">Default</Badge>
            <Badge variant="primary" :outline="true">Primary</Badge>
            <Badge variant="secondary" :outline="true">Secondary</Badge>
            <Badge variant="tertiary" :outline="true">Tertiary</Badge>
            <Badge variant="success" :outline="true">Success</Badge>
            <Badge variant="warning" :outline="true">Warning</Badge>
            <Badge variant="danger" :outline="true">Danger</Badge>
            <Badge variant="info" :outline="true">Info</Badge>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const RoundedVariants: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex flex-wrap gap-4">
            <Badge rounded="none" variant="primary">None</Badge>
            <Badge rounded="sm" variant="primary">Small</Badge>
            <Badge rounded="md" variant="primary">Medium</Badge>
            <Badge rounded="lg" variant="primary">Large</Badge>
            <Badge rounded="full" variant="primary">Full</Badge>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const StatusBadges: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <span class="text-gray-700 dark:text-gray-300">Status:</span>
              <Badge variant="success" size="sm">Active</Badge>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-gray-700 dark:text-gray-300">Status:</span>
              <Badge variant="warning" size="sm">Pending</Badge>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-gray-700 dark:text-gray-300">Status:</span>
              <Badge variant="danger" size="sm">Inactive</Badge>
            </div>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const DifficultyBadges: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex gap-4">
            <Badge variant="success" size="sm">Beginner</Badge>
            <Badge variant="warning" size="sm">Intermediate</Badge>
            <Badge variant="danger" size="sm">Advanced</Badge>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const CourseBadges: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Badge variant="primary" size="xs">Article</Badge>
              <Badge variant="secondary" size="xs">Video</Badge>
              <Badge variant="info" size="xs">Course</Badge>
              <Badge variant="success" size="xs">Free</Badge>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge variant="default" size="sm">Kubernetes</Badge>
              <Badge variant="default" size="sm">Docker</Badge>
              <Badge variant="default" size="sm">GitOps</Badge>
              <Badge variant="default" size="sm">CI/CD</Badge>
            </div>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};

export const CountBadges: Story = {
	args: {
		component: Badge,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-gray-700 dark:text-gray-300">Notifications</span>
              <Badge variant="danger" size="xs" rounded="full">3</Badge>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-700 dark:text-gray-300">Messages</span>
              <Badge variant="primary" size="xs" rounded="full">12</Badge>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-gray-700 dark:text-gray-300">Updates</span>
              <Badge variant="info" size="xs" rounded="full">99+</Badge>
            </div>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};
