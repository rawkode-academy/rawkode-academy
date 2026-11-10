import {
	academyNavigation,
	academyPage,
	academyRelatedContent,
	academyWatch,
	button,
} from "@rawkodeacademy/design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { canvas, Specimen, stills } from "./specimen";

const meta = {
	title: "Design System/Media card",
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The pieces of a video card, from `src/styles/media.ts` and `src/styles/type.ts`: `videoFrame` (the 16:9 still), `coverImage` / `coverImageZoom`, `runtimeBadge`, `cardTitle` and `monoMeta`. `academyPage.card` is the one video card (library, show and technology rails). A scheduled stream is a horizontal feature; the watch page keeps its secondary facts in a rail.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const sessions = [
	{
		title: "Debugging a Cilium network policy that drops DNS",
		date: "6 Nov 2026",
		runtime: "1h 42m",
		still: stills.serviceMesh,
	},
	{
		title: "Hands-on with the Gateway API and Envoy Gateway",
		date: "30 Oct 2026",
		runtime: "1h 18m",
		still: stills.apiServer,
	},
	{
		title: "Klustered: a control plane that will not elect a leader",
		date: "23 Sep 2026",
		runtime: "58 min",
		still: stills.controlPlane,
	},
];

export const Cards: Story = {
	render: () => {
		const page = academyPage();
		const related = academyRelatedContent();
		return (
			<div style={canvas}>
				<Specimen label="academyPage.card: the one video card. Frameless still, mono runtime and date, title">
					<div className={page.feedGrid}>
						{sessions.map((session) => (
							<a key={session.title} className={page.card} href="#session">
								<div className={page.cardArt}>
									<img
										className={page.cardImage}
										src={session.still}
										alt=""
										width="640"
										height="360"
									/>
								</div>
								<div className={page.cardBody}>
									<p className={page.cardMeta}>
										<span>{session.runtime}</span>
										<span aria-hidden="true">·</span>
										<time>{session.date}</time>
									</p>
									<h3 className={page.cardTitle}>{session.title}</h3>
								</div>
							</a>
						))}
					</div>
				</Specimen>
				<Specimen label="academyRelatedContent.card: related sessions under an article, closed by a rule">
					<div className={related.grid}>
						{sessions.map((session) => (
							<a key={session.title} className={related.card} href="#related">
								<div className={related.media}>
									<img
										className={related.image}
										src={session.still}
										alt=""
										width="640"
										height="360"
									/>
									<span className={related.duration}>{session.runtime}</span>
								</div>
								<div className={related.body}>
									<h3 className={related.title}>{session.title}</h3>
								</div>
							</a>
						))}
					</div>
				</Specimen>
			</div>
		);
	},
};

/** One or two scheduled streams: a horizontal feature, not a lone card in a grid. */
export const UpcomingStream: Story = {
	render: () => {
		const page = academyPage();
		return (
			<div style={canvas}>
				<Specimen label="academyPage.streamFeature: label and start time are separate items, the title outranks the description">
					<div className={page.streamList}>
						<a className={page.streamFeature} href="#stream">
							<div className={page.cardArt}>
								<img
									className={page.cardImage}
									src={stills.controlPlane}
									alt=""
									width="960"
									height="540"
								/>
							</div>
							<div className={page.featureCopy}>
								<p className={page.streamMeta}>
									<span data-label>Upcoming live stream</span>
									<time>Wed, 11 Nov 2026, 17:00 UTC</time>
								</p>
								<h3 className={page.streamTitle}>
									Make Your Shell Magical with Atuin
								</h3>
								<p className={page.sectionLede}>
									Shell history, agent sessions and scripts, synced and
									searchable across every machine you work on.
								</p>
								<span className={page.textLink}>
									Get notified <span aria-hidden="true">→</span>
								</span>
							</div>
						</a>
					</div>
				</Specimen>
			</div>
		);
	},
};

/** Under the player: the lesson in a reading column, facts in a rail. */
export const WatchDetail: Story = {
	render: () => {
		const watch = academyWatch();
		const nav = academyNavigation();
		return (
			<div style={canvas}>
				<Specimen label="academyWatch.detail: 680px lesson column, with technologies, cast and the share link in the rail">
					<div className={watch.summaryCopy}>
						<nav className={nav.breadcrumb} aria-label="Breadcrumb">
							<ol className={nav.trail}>
								<li>
									<a className={nav.crumb} href="#watch">
										Watch
									</a>
								</li>
								<li>
									<span className={nav.separator} aria-hidden="true">
										/
									</span>
									<a className={nav.crumb} href="#show">
										Rawkode Live
									</a>
								</li>
							</ol>
						</nav>
						<h1 className={watch.title}>Hands-on introduction to Kueue</h1>
						<p className={watch.meta}>
							<time>17 Jul 2026</time>
							<span>1h 2m</span>
						</p>
					</div>
					<div className={watch.detail}>
						<div className={watch.detailMain}>
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>About this video</h2>
								<section className={watch.learn}>
									<h3 className={watch.learnTitle}>What you'll learn</h3>
									<ol className={watch.learnList} data-academy-learn-list>
										<li>How Kueue admits and queues batch workloads</li>
										<li>Where cluster queues and resource flavours fit</li>
									</ol>
								</section>
								<p className={watch.dek}>
									Kueue is a Kubernetes-native job queueing system. We install
									it, define quotas, and watch it decide which jobs run.
								</p>
								<div className={watch.reactions}>
									<div className={watch.reactionList}>
										<button type="button" className={watch.reactionButton}>
											<span className={watch.reactionEmoji}>👍</span>
											<span className={watch.reactionCount}>12</span>
										</button>
										<button type="button" className={watch.reactionButton}>
											<span className={watch.reactionEmoji}>🚀</span>
										</button>
										<button type="button" className={watch.reactionButton}>
											+
										</button>
									</div>
								</div>
							</section>
						</div>
						<aside className={watch.detailRail}>
							<section className={watch.railSection}>
								<h2 className={watch.railHeading}>Technologies featured</h2>
								<div className={watch.techGrid}>
									{["Kubernetes", "Kueue"].map((name) => (
										<a key={name} className={watch.techChip} href="#tech">
											<span className={watch.techName}>{name}</span>
											<span className={watch.techArrow} aria-hidden="true">
												→
											</span>
										</a>
									))}
								</div>
							</section>
							<section className={watch.cast}>
								<h2 className={watch.railHeading}>Cast</h2>
								<ul className={watch.castGrid}>
									{[
										["David Flanagan", "Host · @rawkode"],
										["Yuki Iwai", "Guest"],
									].map(([name, role]) => (
										<li key={name}>
											<a className={watch.castCard} href="#person">
												<span
													className={`${watch.castAvatar} ${watch.castInitials}`}
													aria-hidden="true"
												>
													{name
														?.split(" ")
														.map((part) => part[0])
														.join("")}
												</span>
												<span className={watch.castBody}>
													<span className={watch.castName}>{name}</span>
													<span className={watch.castMeta}>{role}</span>
												</span>
											</a>
										</li>
									))}
								</ul>
							</section>
							<div className={watch.railSection}>
								<button
									type="button"
									className={button({ variant: "outline", size: "sm" })}
								>
									Copy link
								</button>
							</div>
						</aside>
					</div>
				</Specimen>
			</div>
		);
	},
};
