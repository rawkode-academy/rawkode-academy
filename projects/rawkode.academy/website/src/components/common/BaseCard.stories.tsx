import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Badge from "./Badge.vue";
import BaseCard from "./BaseCard.vue";
import FormattedDate from "./FormattedDate.vue";
import Heading from "./Heading.vue";

const meta = {
	title: "Components/Common/BaseCard",
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
		component: BaseCard,
		props: {
			href: "/example",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <div class="max-w-md">
            <BaseCard :href="href">
              <template #content>
                <h3 class="text-lg font-semibold mb-2">Card Title</h3>
                <p class="text-gray-600 dark:text-gray-300">
                  This is a basic card with just content.
                </p>
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard },
				setup() {
					return { href: args.props?.href || "/example" };
				},
			}}
		/>
	),
};

export const WithCover: Story = {
	args: {
		component: BaseCard,
		props: {
			href: "/article/example",
		},
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="max-w-md">
            <BaseCard href="/article/example">
              <template #cover>
                <img
                  src="https://via.placeholder.com/400x200"
                  alt="Cover image"
                  class="w-full h-48 object-cover"
                />
              </template>
              <template #content>
                <h3 class="text-lg font-semibold mb-2">Article Title</h3>
                <p class="text-gray-600 dark:text-gray-300">
                  A card with a cover image showcasing an article preview.
                </p>
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard },
			}}
		/>
	),
};

export const WithBadge: Story = {
	args: {
		component: BaseCard,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="max-w-md">
            <BaseCard href="/course/kubernetes">
              <template #cover>
                <img
                  src="https://via.placeholder.com/400x200"
                  alt="Course cover"
                  class="w-full h-48 object-cover"
                />
              </template>
              <template #badge>
                <Badge variant="primary">Featured</Badge>
              </template>
              <template #content>
                <h3 class="text-lg font-semibold mb-2">Kubernetes Fundamentals</h3>
                <p class="text-gray-600 dark:text-gray-300">
                  Learn the basics of container orchestration with Kubernetes.
                </p>
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard, Badge },
			}}
		/>
	),
};

export const WithFooter: Story = {
	args: {
		component: BaseCard,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="max-w-md">
            <BaseCard href="/blog/post">
              <template #content>
                <h3 class="text-lg font-semibold mb-2">Blog Post Title</h3>
                <p class="text-gray-600 dark:text-gray-300 mb-4">
                  This card demonstrates the footer slot for metadata or additional information.
                </p>
              </template>
              <template #footer>
                <div class="flex items-center justify-between text-sm text-gray-500">
                  <FormattedDate :date="publishDate" />
                  <span>5 min read</span>
                </div>
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard, FormattedDate },
				setup() {
					return {
						publishDate: new Date("2024-03-10"),
					};
				},
			}}
		/>
	),
};

export const CompleteExample: Story = {
	args: {
		component: BaseCard,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="max-w-md">
            <BaseCard href="/course/advanced-kubernetes">
              <template #cover>
                <img
                  src="https://via.placeholder.com/400x200"
                  alt="Advanced Kubernetes"
                  class="w-full h-48 object-cover"
                />
              </template>
              <template #overlay>
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </template>
              <template #badge>
                <Badge variant="success">New</Badge>
              </template>
              <template #content>
                <Heading as="h3" size="lg" class="mb-2">Advanced Kubernetes Patterns</Heading>
                <p class="text-gray-600 dark:text-gray-300 line-clamp-3">
                  Master advanced deployment patterns, custom operators, and production-ready
                  configurations for enterprise Kubernetes deployments.
                </p>
                <div class="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  <span>24 lessons</span>
                  <span>•</span>
                  <span>6 hours</span>
                  <span>•</span>
                  <span>Expert level</span>
                </div>
              </template>
              <template #footer>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <img
                      src="https://via.placeholder.com/32x32"
                      alt="Author"
                      class="w-8 h-8 rounded-full"
                    />
                    <span class="text-sm font-medium">David Flanagan</span>
                  </div>
                  <FormattedDate :date="updateDate" />
                </div>
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard, Badge, Heading, FormattedDate },
				setup() {
					return {
						updateDate: new Date("2024-03-01"),
					};
				},
			}}
		/>
	),
};

export const CardGrid: Story = {
	args: {
		component: BaseCard,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BaseCard v-for="item in items" :key="item.id" :href="item.href">
              <template #cover>
                <img
                  :src="item.image"
                  :alt="item.title"
                  class="w-full h-48 object-cover"
                />
              </template>
              <template v-if="item.badge" #badge>
                <Badge :variant="item.badgeVariant">{{ item.badge }}</Badge>
              </template>
              <template #content>
                <h3 class="text-lg font-semibold mb-2">{{ item.title }}</h3>
                <p class="text-gray-600 dark:text-gray-300">{{ item.description }}</p>
              </template>
              <template #footer>
                <FormattedDate :date="item.date" />
              </template>
            </BaseCard>
          </div>
        `,
				components: { BaseCard, Badge, FormattedDate },
				setup() {
					const items = [
						{
							id: 1,
							href: "/item/1",
							title: "Getting Started with Docker",
							description:
								"Learn the fundamentals of containerization with Docker.",
							image: "https://via.placeholder.com/400x200",
							badge: "Beginner",
							badgeVariant: "success",
							date: new Date("2024-03-10"),
						},
						{
							id: 2,
							href: "/item/2",
							title: "Kubernetes Security Best Practices",
							description:
								"Secure your Kubernetes clusters with these essential practices.",
							image: "https://via.placeholder.com/400x200",
							badge: "Advanced",
							badgeVariant: "warning",
							date: new Date("2024-03-08"),
						},
						{
							id: 3,
							href: "/item/3",
							title: "CI/CD with GitOps",
							description:
								"Implement continuous deployment using GitOps principles.",
							image: "https://via.placeholder.com/400x200",
							date: new Date("2024-03-05"),
						},
					];
					return { items };
				},
			}}
		/>
	),
};
