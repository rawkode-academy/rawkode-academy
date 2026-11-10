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

// Story layout only. The website has no utility-CSS compiler, so the Vue
// templates below carry inline styles built from the Academy variables.
const wrap = (gap: string) => `display:flex;flex-wrap:wrap;gap:${gap}`;
const row = (gap: string) => `display:flex;align-items:center;gap:${gap}`;
const stack = "display:grid;gap:1rem";
const caption = "color:var(--colors-academy-text-soft)";

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
          <div style="${wrap("1rem")}">
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="secondary">Secondary</Badge>
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
          <div style="${row("1rem")}">
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
          <div style="${wrap("1rem")}">
            <Badge variant="default" :outline="true">Default</Badge>
            <Badge variant="primary" :outline="true">Primary</Badge>
            <Badge variant="secondary" :outline="true">Secondary</Badge>
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
          <div style="${wrap("1rem")}">
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
          <div style="${stack}">
            <div style="${row("1rem")}">
              <span style="${caption}">Status:</span>
              <Badge variant="success" size="sm">Active</Badge>
            </div>
            <div style="${row("1rem")}">
              <span style="${caption}">Status:</span>
              <Badge variant="warning" size="sm">Pending</Badge>
            </div>
            <div style="${row("1rem")}">
              <span style="${caption}">Status:</span>
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
          <div style="display:flex;gap:1rem">
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
          <div style="${stack}">
            <div style="${wrap("0.5rem")}">
              <Badge variant="primary" size="xs">Article</Badge>
              <Badge variant="secondary" size="xs">Video</Badge>
              <Badge variant="info" size="xs">Course</Badge>
              <Badge variant="success" size="xs">Free</Badge>
            </div>
            <div style="${wrap("0.5rem")}">
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
          <div style="${row("1rem")}">
            <div style="${row("0.5rem")}">
              <span style="${caption}">Notifications</span>
              <Badge variant="danger" size="xs" rounded="full">3</Badge>
            </div>
            <div style="${row("0.5rem")}">
              <span style="${caption}">Messages</span>
              <Badge variant="primary" size="xs" rounded="full">12</Badge>
            </div>
            <div style="${row("0.5rem")}">
              <span style="${caption}">Updates</span>
              <Badge variant="info" size="xs" rounded="full">99+</Badge>
            </div>
          </div>
        `,
				components: { Badge },
			}}
		/>
	),
};
