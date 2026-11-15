import { academyCatalog } from "@rawkodeacademy/design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { canvas, Specimen, stills } from "./specimen";

const meta = {
	title: "Design System/Ledger",
	// Screenshot baselines in visual/__screenshots__ (bun run test:visual).
	tags: ["visual"],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The row every chronological collection shares: the day as a numeral, an optional 16:9 still in its own trailing column, then kind, title and one sentence. The `ledger*` fragments in `src/styles/ledger.ts` are spread into `academyCatalog.editorial*` (Read, News). The homepage sets a compact three-column form of the same row (`academyPage.entry*`, see `Pages/Homepage`).",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const stream = [
	{
		day: "06",
		month: "Nov 2026",
		kind: "Video",
		detail: "1h 42m",
		title: "Debugging a Cilium network policy that drops DNS",
		description:
			"A cluster where pods resolve nothing. We follow one query from the pod to CoreDNS with Hubble and find the policy that eats it.",
		still: stills.serviceMesh,
	},
	{
		day: "03",
		month: "Nov 2026",
		kind: "Article",
		detail: "9 min read",
		title: "What the API server does with your manifest before etcd sees it",
		description:
			"Authentication, admission, defaulting and validation, in the order they run and with the flags that change them.",
		still: stills.apiServer,
	},
];

/** Read and News: one kind per collection, so the line carries facts instead of a dot. */
export const ArticlesAndNews: Story = {
	render: () => {
		const s = academyCatalog();
		return (
			<div style={canvas}>
				<Specimen label="academyCatalog.editorial*: articles with a cover">
					<div className={s.editorialList}>
						{stream.slice(0, 2).map((item) => (
							<a
								key={item.title}
								className={s.editorialRow}
								href="#row"
								data-media="true"
							>
								<time className={s.editorialDate}>
									<strong>{item.day}</strong>
									<span>{item.month}</span>
								</time>
								<span className={s.editorialMedia}>
									<img
										className={s.editorialImage}
										src={item.still}
										alt=""
										width="640"
										height="360"
									/>
								</span>
								<div className={s.editorialBody} data-body>
									<p className={s.editorialKind}>
										<span>Tutorial</span>
										<span>·</span>
										<span>David Flanagan</span>
										<span>·</span>
										<span>9 min read</span>
									</p>
									<h3 className={s.editorialTitle}>{item.title}</h3>
									<p className={s.editorialDescription}>{item.description}</p>
								</div>
							</a>
						))}
					</div>
				</Specimen>
				<Specimen label="academyCatalog.editorial*: news is text-led, data-media false">
					<div className={s.editorialList}>
						{[
							{
								day: "29",
								title:
									"Kubernetes 1.36 graduates in-place pod resize to stable",
								description:
									"CPU and memory can now change on a running pod without a restart.",
							},
							{
								day: "27",
								title: "Cilium 1.19 adds per-node BGP advertisement policies",
								description:
									"Operators can now scope which services a node announces without a second control plane.",
							},
						].map((story) => (
							<a
								key={story.title}
								className={s.editorialRow}
								href="#story"
								data-media="false"
							>
								<time className={s.editorialDate}>
									<strong>{story.day}</strong>
									<span>Oct 2026</span>
								</time>
								<div className={s.editorialBody} data-body>
									<h3 className={s.editorialTitle}>{story.title}</h3>
									<p className={s.editorialDescription}>{story.description}</p>
								</div>
							</a>
						))}
					</div>
				</Specimen>
			</div>
		);
	},
};
