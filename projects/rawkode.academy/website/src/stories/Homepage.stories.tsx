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
					"The homepage composition (`AcademyPage.vue`, `academyPage` recipe) with local fixtures: the statement hero, the next live stream and the latest session as a pair, the field index of the four collections on an ink band, the three-column ledger and the learning paths. Production stills come from the content CDN; these fixtures use artwork that ships in `public/`. The site header, the newsletter and the footer are Astro and are not part of the story.",
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
	description:
		"A first build in Swamp Club, from an empty project to a running service.",
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
	],
};

const leadArticle = {
	href: "/read/seccomp-for-kubernetes-workloads",
	title:
		"Seccomp for Kubernetes workloads: from RuntimeDefault to application profiles",
	publishedAt: "2026-10-01T00:00:00.000Z",
	meta: ["Guide", "David Flanagan"],
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
		{
			href: "/read/ebpf-without-the-magic",
			title: "eBPF without the magic: one probe, read line by line",
			publishedAt: "2026-08-06T00:00:00.000Z",
			meta: ["Tutorial", "David Flanagan"],
		},
		{
			href: "/read/what-admission-does",
			title: "What the API server does with your manifest before etcd sees it",
			publishedAt: "2026-07-21T00:00:00.000Z",
			meta: ["Article", "David Flanagan"],
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
			meta: ["David Flanagan"],
		},
		{
			href: "/news/kubernetes-1-36",
			title: "Kubernetes 1.36 graduates in-place pod resize to stable",
			publishedAt: "2026-09-02T09:00:00.000Z",
			meta: ["David Flanagan"],
		},
		{
			href: "/news/cilium-1-19",
			title: "Cilium 1.19 adds per-node BGP advertisement policies",
			publishedAt: "2026-08-19T09:00:00.000Z",
			meta: ["David Flanagan"],
		},
		{
			href: "/news/gateway-api-1-4",
			title: "Gateway API 1.4 moves BackendTLSPolicy to the standard channel",
			publishedAt: "2026-08-04T09:00:00.000Z",
			meta: ["David Flanagan"],
		},
		{
			href: "/news/containerd-2-2",
			title: "containerd 2.2 ships with user namespaces on by default",
			publishedAt: "2026-07-15T09:00:00.000Z",
			meta: ["David Flanagan"],
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

const laterStream = {
	href: "/watch/debugging-a-cilium-network-policy",
	title: "Debugging a Cilium network policy that drops DNS",
	publishedAt: "2026-11-18T17:30:00.000Z",
};

/** Every section present: a stream scheduled beside the latest session, three ledger columns. */
export const Full: Story = {
	tags: ["visual-mobile"],
	render: () => <VueInReact component={AcademyPage} props={full} />,
};

/** Nothing scheduled: the latest session takes the full width as a spread, with the solid action. */
export const NoUpcomingStream: Story = {
	tags: ["!visual", "!visual-mobile"],
	render: () => (
		<VueInReact component={AcademyPage} props={{ ...full, upcoming: [] }} />
	),
};

/** Two streams scheduled: the first is in the pair, the second is listed under it. */
export const TwoStreams: Story = {
	tags: ["!visual", "!visual-mobile"],
	render: () => (
		<VueInReact
			component={AcademyPage}
			props={{ ...full, upcoming: [...upcoming, laterStream] }}
		/>
	),
};

/** One article and no news: the News column is gone, two columns share the measure in halves, and the one-row column is not stretched. */
export const Sparse: Story = {
	tags: ["!visual", "!visual-mobile"],
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
	tags: ["!visual", "!visual-mobile"],
	render: () => (
		<VueInReact
			component={AcademyPage}
			props={{ ...full, ledger: [sessions] }}
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
	tags: ["!visual", "!visual-mobile"],
	render: () => <WithSystem />,
};
