import { academyCatalog, academyPage } from "@rawkodeacademy/design-system";
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
					"The row every chronological collection shares: the day as a numeral, an optional 16:9 still in its own trailing column, then kind, title and one sentence. The `ledger*` fragments in `src/styles/ledger.ts` are spread into `academyPage.ledger*` (homepage stream) and `academyCatalog.editorial*` (Read, News).",
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
	{
		day: "29",
		month: "Oct 2026",
		kind: "News",
		detail: "",
		title: "Kubernetes 1.36 graduates in-place pod resize to stable",
		description:
			"CPU and memory can now change on a running pod without a restart, with a resize policy per container.",
		still: undefined,
	},
	{
		day: "21",
		month: "Oct 2026",
		kind: "Course",
		detail: "14 lessons",
		title: "Complete guide to Zitadel",
		description:
			"Identity for a real product: organisations, projects, actions and machine users, built up one working step at a time.",
		still: stills.controlPlane,
	},
];

/** The homepage stream: every kind in one ledger, each with its status dot. */
export const HomepageStream: Story = {
	tags: ["visual-mobile"],
	render: () => {
		const s = academyPage();
		return (
			<div style={canvas}>
				<Specimen label="academyPage.ledger*: mixed kinds, stills where the content has one">
					<div className={s.ledger}>
						{stream.map((item) => (
							<a
								key={item.title}
								className={s.ledgerRow}
								href="#row"
								data-media={Boolean(item.still)}
							>
								<time className={s.ledgerDate}>
									<strong>{item.day}</strong>
									<span>{item.month}</span>
								</time>
								{item.still && (
									<span className={s.ledgerMedia}>
										<img
											className={s.ledgerImage}
											src={item.still}
											alt=""
											width="640"
											height="360"
										/>
									</span>
								)}
								<span className={s.ledgerBody} data-body>
									<span className={s.ledgerKind} data-kind={item.kind}>
										{item.kind}
										{item.detail && ` · ${item.detail}`}
									</span>
									<h3 className={s.ledgerTitle}>{item.title}</h3>
									<span className={s.ledgerDescription}>
										{item.description}
									</span>
								</span>
							</a>
						))}
					</div>
				</Specimen>
			</div>
		);
	},
};

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
