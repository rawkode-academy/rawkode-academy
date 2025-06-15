import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import Button from "./Button.vue";
import PageHero from "./PageHero.vue";

const meta = {
	title: "Components/Common/PageHero",
	component: VueInReact,
	parameters: {
		layout: "fullscreen",
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
		component: PageHero,
		props: {
			title: "Welcome to Rawkode Academy",
			subtitle:
				"Learn cloud native technologies through hands-on courses and real-world examples",
		},
	},
};

export const WithBadge: Story = {
	args: {
		component: PageHero,
		props: {
			title: "Cloud Native Courses",
			subtitle: "Master Kubernetes, GitOps, and modern infrastructure",
			badge: "Featured",
		},
	},
};

export const WithStats: Story = {
	args: {
		component: PageHero,
		props: {
			title: "Technical Articles",
			subtitle: "Deep dives into cloud native technologies",
			stats: [
				{ label: "150+ Articles" },
				{ label: "50K+ Readers" },
				{ label: "Updated Weekly" },
			],
		},
	},
};

export const WithActions: Story = {
	args: {
		component: PageHero,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <PageHero
            title="Start Your Learning Journey"
            subtitle="Join thousands of developers learning cloud native technologies"
            badge="New"
          >
            <template #actions>
              <Button variant="primary" size="lg">Browse Courses</Button>
              <Button variant="secondary" size="lg">Watch Videos</Button>
            </template>
          </PageHero>
        `,
				components: { PageHero, Button },
			}}
		/>
	),
};

export const ArticlesPage: Story = {
	args: {
		component: PageHero,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <PageHero
            title="Articles & Tutorials"
            subtitle="In-depth technical content on cloud native technologies, DevOps practices, and platform engineering"
            :stats="[
              { label: '156 Articles' },
              { label: '12 Series' },
              { label: 'Updated Daily' }
            ]"
          >
            <template #actions>
              <Button variant="primary">Latest Articles</Button>
              <Button variant="ghost">Browse by Topic</Button>
            </template>
          </PageHero>
        `,
				components: { PageHero, Button },
			}}
		/>
	),
};

export const CoursesPage: Story = {
	args: {
		component: PageHero,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <PageHero
            title="Professional Cloud Native Courses"
            subtitle="Comprehensive, hands-on courses designed to take you from beginner to expert"
            badge="30% Off This Month"
            :stats="[
              { label: '24 Courses' },
              { label: '180+ Hours' },
              { label: 'Certificate Included' }
            ]"
          >
            <template #actions>
              <Button variant="primary" size="lg">View All Courses</Button>
              <Button variant="secondary" size="lg">Free Preview</Button>
            </template>
          </PageHero>
        `,
				components: { PageHero, Button },
			}}
		/>
	),
};

export const MinimalHero: Story = {
	args: {
		component: PageHero,
		props: {
			title: "About Rawkode Academy",
		},
	},
};
