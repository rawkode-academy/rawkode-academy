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

// Specimen layout for the composite stories. Product styles live in
// design-system recipes; these inline styles only arrange the story.
const stack = "display: grid; gap: var(--spacing-8)";
const label =
	"margin: 0 0 var(--spacing-2); color: var(--colors-academy-text-soft); font-size: var(--font-sizes-sm); font-weight: var(--font-weights-medium)";
const panel =
	"padding: var(--spacing-6); border: 1px solid var(--colors-academy-border); border-radius: var(--radii-academy-l); background: var(--colors-academy-panel); color: var(--colors-academy-text)";
const heading =
	"margin: 0 0 var(--spacing-2); font-size: var(--font-sizes-xl); font-weight: var(--font-weights-bold)";
const byline =
	"display: flex; align-items: center; gap: var(--spacing-4); margin-block-end: var(--spacing-4); color: var(--colors-academy-text-muted); font-size: var(--font-sizes-sm)";
const excerpt = "margin: 0; color: var(--colors-academy-text-soft)";

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
          <div style="${stack}">
            <div>
              <h3 style="${label}">Single Author</h3>
              <AuthorAvatarGroup :authors="authors.slice(0, 1)" />
            </div>

            <div>
              <h3 style="${label}">Two Authors</h3>
              <AuthorAvatarGroup :authors="authors.slice(0, 2)" />
            </div>

            <div>
              <h3 style="${label}">Multiple Authors (Default)</h3>
              <AuthorAvatarGroup :authors="authors" />
            </div>

            <div>
              <h3 style="${label}">Without Names</h3>
              <AuthorAvatarGroup :authors="authors" :showNames="false" />
            </div>

            <div>
              <h3 style="${label}">Max Display = 2</h3>
              <AuthorAvatarGroup :authors="authors" :maxDisplay="2" />
            </div>

            <div>
              <h3 style="${label}">Without Active Indicator</h3>
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
          <article style="${panel}">
            <h2 style="${heading}">Understanding Kubernetes Deployments</h2>
            <div style="${byline}">
              <AuthorAvatarGroup :authors="authors.slice(0, 2)" />
              <span aria-hidden="true">•</span>
              <span>March 15, 2024</span>
              <span aria-hidden="true">•</span>
              <span>5 min read</span>
            </div>
            <p style="${excerpt}">
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
