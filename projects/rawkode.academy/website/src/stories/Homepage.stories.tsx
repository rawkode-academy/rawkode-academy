import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import AcademyPage from "../components/academy/AcademyPage.vue";
import { VueInReact } from "../components/vue-wrapper";
import { mountSystem } from "../lib/system-canvas";
import { stills } from "./specimen";

const meta = {
	title: "Pages/Homepage",
	// Screenshot baselines in visual/__screenshots__ (bun run test:visual).
	tags: ["visual"],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The homepage composition (`AcademyPage.vue`, `academyPage` recipe) with local fixtures: the hero index of the four collections, the latest session as a spread, the three-column ledger, the upcoming-stream band and the learning paths. Production stills come from the content CDN; these fixtures use artwork that ships in `public/`. The site header, the newsletter and the footer are Astro and are not part of the story.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const collections = [
	{
		href: "/watch",
		label: "Videos",
		count: 330,
		description:
			"Hands-on sessions with the people who build the tools, kept whole.",
	},
	{
		href: "/read",
		label: "Articles",
		count: 34,
		description:
			"Guides you can follow at a terminal, with the reasoning written down.",
	},
	{
		href: "/learning-paths",
		label: "Learning paths",
		count: 4,
		description:
			"Archive sessions in a deliberate order, each building on the last.",
	},
	{
		href: "/courses",
		label: "Courses",
		count: 4,
		description:
			"Structured courses, taught a module at a time and open to everyone.",
	},
];

const featured = {
	href: "/watch/hands-on-introduction-to-swamp-club",
	title: "Hands-on Introduction to Swamp Club",
	publishedAt: "2026-10-22T16:00:00.000Z",
	mediaSrc: stills.controlPlane,
	runtime: "1h 2m",
	guests: ["Nick Stinemates"],
	show: { href: "/shows/rawkode-live", name: "Rawkode Live", episodes: 175 },
};

const sessions = {
	id: "sessions",
	title: "Sessions",
	href: "/watch",
	more: "All 330 videos",
	total: 330,
	entries: [
		{
			href: "/watch/hands-on-introduction-to-kueue",
			title: "Hands-on Introduction to Kueue",
			publishedAt: "2026-10-15T16:00:00.000Z",
			meta: ["1h 18m", "with Yuki Iwai"],
		},
		{
			href: "/watch/hands-on-introduction-to-odin",
			title: "Hands-on Introduction to Odin",
			publishedAt: "2026-10-08T16:00:00.000Z",
			meta: ["1h 16m"],
		},
		{
			href: "/watch/hands-on-introduction-to-iroh",
			title: "Hands-on Introduction to Iroh",
			publishedAt: "2026-10-01T16:00:00.000Z",
			meta: ["1h 30m", "with Rüdiger Klaehn"],
		},
		{
			href: "/watch/hands-on-introduction-to-yoke",
			title: "Hands-on Introduction to Yoke",
			publishedAt: "2026-09-24T16:00:00.000Z",
			meta: ["1h 15m"],
		},
		{
			href: "/watch/hands-on-introduction-to-sympozium",
			title: "Hands-on Introduction to sympozium",
			publishedAt: "2026-09-17T16:00:00.000Z",
			meta: ["1h 31m"],
		},
		{
			href: "/watch/hadron-minimal-secure-linux-for-cloud",
			title: "Hadron: Minimal & Secure Linux for Cloud",
			publishedAt: "2026-09-10T16:00:00.000Z",
			meta: ["9 min"],
		},
	],
};

const leadArticle = {
	href: "/read/seccomp-for-kubernetes-workloads",
	title:
		"Seccomp for Kubernetes workloads: from RuntimeDefault to application profiles",
	publishedAt: "2026-10-01T00:00:00.000Z",
	meta: ["Guide", "David Flanagan"],
	description:
		"Record, review, and roll out application seccomp profiles for Kubernetes, with errno compatibility, logging, distroless verification, and new-node handling.",
	mediaSrc: stills.apiServer,
};

const articles = {
	id: "articles",
	title: "Articles",
	href: "/read",
	more: "All 34 articles",
	total: 34,
	entries: [
		leadArticle,
		{
			href: "/read/cgroups-v2-for-kubernetes-operators",
			title: "What cgroup v2 changes for the people who run the nodes",
			publishedAt: "2026-09-12T00:00:00.000Z",
			meta: ["Article", "David Flanagan"],
		},
		{
			href: "/read/gateway-api-from-ingress",
			title: "Moving from Ingress to the Gateway API, one route at a time",
			publishedAt: "2026-08-27T00:00:00.000Z",
			meta: ["Tutorial", "David Flanagan"],
		},
	],
};

const news = {
	id: "news",
	title: "News",
	href: "/news",
	more: "All news",
	total: 12,
	entries: [
		{
			href: "/news/klustered-winter-2026",
			title: "Klustered Winter 2026 starts Wednesday 18 November",
			publishedAt: "2026-09-25T09:00:00.000Z",
			description:
				"A pre-season from 18 November, then the Solo bracket in January, at 17:30 GMT.",
		},
		{
			href: "/news/kubernetes-1-36",
			title: "Kubernetes 1.36 graduates in-place pod resize to stable",
			publishedAt: "2026-09-02T09:00:00.000Z",
			description:
				"CPU and memory can now change on a running pod without a restart.",
		},
	],
};

const upcoming = [
	{
		href: "/watch/make-your-shell-magical-with-atuin",
		title: "Make Your Shell Magical with Atuin",
		description:
			"Shell history, agent sessions, and working across machines with Atuin creator Ellie Huxtable.",
		publishedAt: "2026-11-11T12:00:00.000Z",
		mediaSrc: stills.serviceMesh,
	},
];

const learningPaths = [
	{
		href: "/learning-paths/mastering-kubernetes-security-posture-and-policy",
		title: "Kubernetes Security Blueprint: Posture to Policy",
		description: "",
		meta: ["Intermediate", "8h 20m core video"],
		sessions: 7,
	},
	{
		href: "/learning-paths/build-your-first-kubernetes-developer-platform",
		title: "Build Your First Kubernetes Developer Platform",
		description: "",
		meta: ["Beginner", "7h 8m core video"],
		sessions: 6,
	},
	{
		href: "/learning-paths/gitops-landscape",
		title: "GitOps Landscape",
		description: "",
		meta: ["Intermediate", "6h 2m core video"],
		sessions: 5,
	},
	{
		href: "/learning-paths/klustered-advanced-cluster-triage",
		title: "Klustered: Advanced Cluster Triage",
		description: "",
		meta: ["Advanced", "5h 41m core video"],
		sessions: 5,
	},
];

const full = {
	page: "home",
	collections,
	featured,
	ledger: [sessions, articles, news],
	upcoming,
	learningPaths,
};

/** Every section present: three ledger columns and an upcoming stream. */
export const Full: Story = {
	tags: ["visual-mobile"],
	render: () => <VueInReact component={AcademyPage} props={full} />,
};

/** Nothing scheduled: the ink band is not rendered and the hero drops "Next live". */
export const NoUpcomingStream: Story = {
	tags: ["!visual"],
	render: () => (
		<VueInReact component={AcademyPage} props={{ ...full, upcoming: [] }} />
	),
};

/** One article and no news: the News column is gone and two columns share the measure 7/5. */
export const Sparse: Story = {
	tags: ["!visual"],
	render: () => (
		<VueInReact
			component={AcademyPage}
			props={{
				...full,
				ledger: [
					sessions,
					{
						...articles,
						more: "All 1 article",
						total: 1,
						entries: [leadArticle],
					},
					{ ...news, total: 0, entries: [] },
				],
				upcoming: [],
			}}
		/>
	),
};

/** Only sessions: one column runs the full measure with its rows two abreast. */
export const SessionsOnly: Story = {
	tags: ["!visual"],
	render: () => (
		<VueInReact
			component={AcademyPage}
			props={{
				...full,
				ledger: [sessions],
				upcoming: [
					...upcoming,
					{
						...upcoming[0],
						href: "/watch/later",
						title: "Debugging a Cilium network policy that drops DNS",
						publishedAt: "2026-11-18T17:30:00.000Z",
					},
				],
			}}
		/>
	),
};

const WithSystem = () => {
	useEffect(() => {
		const hero = document.querySelector<HTMLElement>("[data-system]");
		if (hero) mountSystem(hero);
	}, []);
	return <VueInReact component={AcademyPage} props={full} />;
};

/**
 * The hero with the living system mounted, as on the site. The system is
 * random, so this story has no screenshot baseline.
 */
export const LivingSystem: Story = {
	tags: ["!visual"],
	render: () => <WithSystem />,
};
