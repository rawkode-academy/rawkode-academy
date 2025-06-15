import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Button from "./Button.vue";

const meta = {
	title: "Components/Common/Button",
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

export const Primary: Story = {
	args: {
		component: Button,
		props: {
			variant: "primary",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Primary Button",
			}}
		/>
	),
};

export const Secondary: Story = {
	args: {
		component: Button,
		props: {
			variant: "secondary",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Secondary Button",
			}}
		/>
	),
};

export const Ghost: Story = {
	args: {
		component: Button,
		props: {
			variant: "ghost",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Ghost Button",
			}}
		/>
	),
};

export const Danger: Story = {
	args: {
		component: Button,
		props: {
			variant: "danger",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Danger Button",
			}}
		/>
	),
};

export const Sizes: Story = {
	args: {
		component: Button,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        `,
				components: { Button },
			}}
		/>
	),
};

export const WithIcons: Story = {
	args: {
		component: Button,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="flex flex-col gap-4">
            <Button>
              <template #icon-left>
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </template>
              Add Item
            </Button>
            <Button variant="secondary">
              Continue
              <template #icon-right>
                <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
              </template>
            </Button>
          </div>
        `,
				components: { Button },
			}}
		/>
	),
};

export const AsLink: Story = {
	args: {
		component: Button,
		props: {
			href: "#",
			variant: "primary",
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Link Button",
			}}
		/>
	),
};

export const Disabled: Story = {
	args: {
		component: Button,
		props: {
			disabled: true,
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Disabled Button",
			}}
		/>
	),
};

export const FullWidth: Story = {
	args: {
		component: Button,
		props: {
			fullWidth: true,
		},
	},
	render: (args) => (
		<VueInReact
			component={args.component}
			props={{
				...args.props,
				default: "Full Width Button",
			}}
		/>
	),
	decorators: [
		(Story) => (
			<div style={{ width: "400px" }}>
				<Story />
			</div>
		),
	],
};
