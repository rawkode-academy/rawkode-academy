import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import AuthorAvatarGroup from "./AuthorAvatarGroup.vue";

const meta = {
	title: "Components/Common/AuthorAvatarGroup",
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

// Mock author data
const mockAuthors = [
	{
		id: "1",
		slug: "david-flanagan",
		collection: "people" as const,
		data: {
			name: "David Flanagan",
			handle: "rawkode",
			bio: "Cloud Native Advocate",
			isDraft: false,
		},
	},
	{
		id: "2",
		slug: "jane-doe",
		collection: "people" as const,
		data: {
			name: "Jane Doe",
			handle: "janedoe",
			bio: "Software Engineer",
			isDraft: false,
		},
	},
	{
		id: "3",
		slug: "john-smith",
		collection: "people" as const,
		data: {
			name: "John Smith",
			handle: "johnsmith",
			bio: "DevOps Engineer",
			isDraft: false,
		},
	},
	{
		id: "4",
		slug: "alice-johnson",
		collection: "people" as const,
		data: {
			name: "Alice Johnson",
			handle: "alicej",
			bio: "Platform Engineer",
			isDraft: false,
		},
	},
	{
		id: "5",
		slug: "bob-wilson",
		collection: "people" as const,
		data: {
			name: "Bob Wilson",
			handle: "bobw",
			bio: "SRE",
			isDraft: false,
		},
	},
];

export const Default: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors.slice(0, 2),
		},
	},
};

export const SingleAuthor: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors.slice(0, 1),
		},
	},
};

export const MultipleAuthors: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors,
		},
	},
};

export const WithoutNames: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors,
			showNames: false,
		},
	},
};

export const WithoutActiveIndicator: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors.slice(0, 2),
			showActiveIndicator: false,
		},
	},
};

export const CustomMaxDisplay: Story = {
	args: {
		component: AuthorAvatarGroup,
		props: {
			authors: mockAuthors,
			maxDisplay: 2,
		},
	},
};

export const AllVariations: Story = {
	args: {
		component: AuthorAvatarGroup,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-8">
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Single Author</h3>
              <AuthorAvatarGroup :authors="authors.slice(0, 1)" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Two Authors</h3>
              <AuthorAvatarGroup :authors="authors.slice(0, 2)" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Multiple Authors (Default)</h3>
              <AuthorAvatarGroup :authors="authors" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Without Names</h3>
              <AuthorAvatarGroup :authors="authors" :showNames="false" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Max Display = 2</h3>
              <AuthorAvatarGroup :authors="authors" :maxDisplay="2" />
            </div>
            
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-2">Without Active Indicator</h3>
              <AuthorAvatarGroup :authors="authors.slice(0, 2)" :showActiveIndicator="false" />
            </div>
          </div>
        `,
				components: { AuthorAvatarGroup },
				setup() {
					return { authors: mockAuthors };
				},
			}}
		/>
	),
};

export const InContext: Story = {
	args: {
		component: AuthorAvatarGroup,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <article class="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 class="text-xl font-bold mb-2">Understanding Kubernetes Deployments</h2>
            <div class="flex items-center gap-4 mb-4">
              <AuthorAvatarGroup :authors="authors.slice(0, 2)" />
              <span class="text-sm text-gray-500">•</span>
              <span class="text-sm text-gray-500">March 15, 2024</span>
              <span class="text-sm text-gray-500">•</span>
              <span class="text-sm text-gray-500">5 min read</span>
            </div>
            <p class="text-gray-700 dark:text-gray-300">
              Learn how to effectively manage and scale your applications using Kubernetes deployments...
            </p>
          </article>
        `,
				components: { AuthorAvatarGroup },
				setup() {
					return { authors: mockAuthors };
				},
			}}
		/>
	),
};
