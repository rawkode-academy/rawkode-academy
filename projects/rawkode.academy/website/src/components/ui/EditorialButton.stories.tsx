import type { StoryObj } from "@storybook/vue3";
import EditorialButton from "./EditorialButton.vue";

const meta = {
	title: "UI/Editorial/EditorialButton",
	component: EditorialButton,
	tags: ["autodocs"],
	argTypes: {
		variant: { control: "select", options: ["solid", "outline", "ghost"] },
		size: { control: "select", options: ["sm", "md", "lg"] },
		arrow: { control: "boolean" },
	},
};
export default meta;
type Story = StoryObj<typeof EditorialButton>;

export const Default: Story = {
	render: (args) => ({
		components: { EditorialButton },
		setup: () => ({ args }),
		template: `<EditorialButton v-bind="args">Start watching — free</EditorialButton>`,
	}),
	args: { variant: "solid", size: "md", arrow: true },
};

export const Variants: Story = {
	render: () => ({
		components: { EditorialButton },
		template: `
			<div style="display:flex;flex-direction:column;gap:1rem;align-items:flex-start">
				<EditorialButton variant="solid" :arrow="true">Start watching</EditorialButton>
				<EditorialButton variant="outline">Weekly field notes</EditorialButton>
				<EditorialButton variant="ghost">Cancel</EditorialButton>
			</div>
		`,
	}),
};

export const Sizes: Story = {
	render: () => ({
		components: { EditorialButton },
		template: `
			<div style="display:flex;gap:1rem;align-items:center">
				<EditorialButton size="sm">Small</EditorialButton>
				<EditorialButton size="md">Medium</EditorialButton>
				<EditorialButton size="lg">Large</EditorialButton>
			</div>
		`,
	}),
};
