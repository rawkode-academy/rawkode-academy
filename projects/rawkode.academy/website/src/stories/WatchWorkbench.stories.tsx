import {
	academyLabel,
	academyLayout,
	academyNavigation,
	academyWatch,
	button,
} from "@rawkodeacademy/design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { stills } from "./specimen";

// The watch page (`src/pages/watch/[...slug].astro`) cannot render in
// Storybook: it is an Astro route fed by the content API. These stories
// repeat its markup with fixtures so the composition can be reviewed and
// screenshotted. Change the route and this file together.

const meta = {
	title: "Pages/Watch workbench",
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"`academyWatch`: the two-pane workbench. From `lg` the player is pinned in the ink pane with the title, technologies and what to watch next; the canvas pane holds the notes. Below `lg` it is one column and the player shrinks to a strip as the page scrolls.",
			},
		},
	},
	tags: ["visual", "visual-mobile"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface Person {
	name: string;
	role: "Host" | "Guest";
	handle?: string;
	portrait?: string;
}
interface Resource {
	title: string;
	description?: string;
	category: string;
}
interface Session {
	title: string;
	show?: string;
	date: string;
	runtime?: string;
	kind: string;
	status?: "Upcoming" | "Live now";
	scheduled?: string;
	still: string;
	lede?: string | undefined;
	description: string[];
	learn: string[];
	resources: Resource[];
	cast: Person[];
	technologies: string[];
	chapters: { time: string; title: string }[];
	transcript: { time: string; text: string }[];
	upNext: { title: string; runtime: string; still: string }[];
	total?: number;
}

const initials = (name: string) =>
	name
		.split(" ")
		.slice(0, 2)
		.map((part) => part[0])
		.join("");

const Workbench = ({ session }: { session: Session }) => {
	const watch = academyWatch();
	const nav = academyNavigation();
	const prose = academyLayout({ width: "wide" }).prose;
	const label = academyLabel({ tone: "accent" });
	const upcoming = session.status === "Upcoming";
	const hasKinds = session.resources.some((r) => r.category !== "other");
	return (
		<div className={watch.root}>
			<div className={watch.bench}>
				<div className={watch.pane}>
					<div className={watch.paneSticky}>
						<div className={watch.paneInner}>
							<div className={watch.deck}>
								<div className={watch.deckInner}>
									<div className={watch.playerFrame}>
										<img
											className={watch.poster}
											src={session.still}
											alt=""
											width="1280"
											height="720"
										/>
									</div>
									<div className={watch.strip}>
										{!upcoming && (
											<button
												type="button"
												className={button({
													variant: "quiet",
													surface: "ink",
													icon: true,
												})}
												aria-label="Play"
											>
												<svg
													viewBox="0 0 24 24"
													fill="currentColor"
													aria-hidden="true"
												>
													<path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.5-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2Z" />
												</svg>
											</button>
										)}
										<a className={watch.stripLink} href="#story-top">
											<span className="sr-only">Back to the player: </span>
											<span className={watch.stripTitle}>{session.title}</span>
											{session.runtime && (
												<span className={watch.stripTime}>
													{session.runtime}
												</span>
											)}
										</a>
									</div>
								</div>
							</div>
							<div className={watch.deckSpace} aria-hidden="true" />

							<header className={watch.session}>
								<div className={watch.breadcrumb}>
									<nav className={nav.breadcrumb} aria-label="Breadcrumb">
										<ol className={nav.trail}>
											<li>
												<a className={nav.crumb} href="#watch">
													Watch
												</a>
											</li>
											{session.show && (
												<li>
													<span className={nav.separator} aria-hidden="true">
														/
													</span>
													<a className={nav.crumb} href="#show">
														{session.show}
													</a>
												</li>
											)}
										</ol>
									</nav>
									{session.status && (
										<span className={watch.breadcrumbStatus}>
											{session.status}
										</span>
									)}
								</div>
								<h1 className={watch.title}>{session.title}</h1>
								<p className={watch.meta}>
									<time>{session.date}</time>
									{session.runtime && !upcoming && (
										<span>{session.runtime}</span>
									)}
									<span className={watch.metaKind}>
										<span className={label.root}>{session.kind}</span>
									</span>
								</p>
								{upcoming && (
									<div className={watch.upcoming}>
										<h2 className={watch.noticeTitle}>
											This session has not started yet.
										</h2>
										<p className={watch.noticeCopy}>
											Join us on <time>{session.scheduled}</time>. The player
											will activate when the stream is available.
										</p>
										<button
											type="button"
											className={button({ surface: "ink" })}
										>
											Notify me
										</button>
									</div>
								)}
								<div className={watch.actions}>
									<button
										type="button"
										className={button({
											variant: "outline",
											surface: "ink",
											size: "sm",
										})}
									>
										Copy link
									</button>
								</div>
							</header>

							{(session.technologies.length > 0 ||
								session.upNext.length > 0) && (
								<aside className={watch.extras} aria-label="About this session">
									{session.technologies.length > 0 && (
										<section className={watch.extrasBlock}>
											<h2 className={watch.inkHeading}>
												Technologies featured
											</h2>
											<ul className={watch.techGrid}>
												{session.technologies.map((name) => (
													<li key={name}>
														<a className={watch.techChip} href="#technology">
															<span className={watch.techName}>{name}</span>
														</a>
													</li>
												))}
											</ul>
										</section>
									)}
									{session.upNext.length > 0 && (
										<section className={watch.extrasBlock}>
											<div className={watch.inkHeader}>
												<h2 className={watch.inkHeading}>
													More from {session.show}
												</h2>
												<a className={watch.inkLink} href="#show">
													All {session.total} episodes{" "}
													<span aria-hidden="true">→</span>
												</a>
											</div>
											<ul className={watch.upNextList}>
												{session.upNext.map((video) => (
													<li key={video.title}>
														<a className={watch.upNextLink} href="#video">
															<span className={watch.upNextStill}>
																<img
																	className={watch.upNextImage}
																	src={video.still}
																	alt=""
																	width="320"
																	height="180"
																/>
															</span>
															<span className={watch.upNextBody}>
																<span className={watch.upNextMeta}>
																	{video.runtime}
																</span>
																<h3 className={watch.upNextTitle} data-title>
																	{video.title}
																</h3>
															</span>
														</a>
													</li>
												))}
											</ul>
										</section>
									)}
								</aside>
							)}
						</div>
					</div>
				</div>

				<div className={watch.notes}>
					<div className={watch.notesInner}>
						<section className={watch.section}>
							<h2 className="sr-only">About this video</h2>
							{session.lede && <p className={watch.lede}>{session.lede}</p>}
							<div
								className={`${prose} ${watch.description}`}
								data-academy-prose
							>
								{session.description.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))}
							</div>
							<div className={watch.reactions}>
								<div
									className={watch.reactionList}
									role="group"
									aria-label="React to this video"
								>
									{[
										["👍", "Like", 12],
										["👏", "Applause", 0],
										["🚀", "Rocket", 3],
										["💡", "Insightful", 0],
									].map(([emoji, name, count]) => (
										<button
											key={name}
											type="button"
											className={watch.reactionButton}
											aria-label={String(name)}
										>
											<span className={watch.reactionEmoji}>{emoji}</span>
											{count ? (
												<span className={watch.reactionCount}>{count}</span>
											) : null}
										</button>
									))}
									<button
										type="button"
										className={watch.reactionButton}
										aria-label="React with another emoji"
									>
										+
									</button>
								</div>
							</div>
						</section>

						{session.learn.length > 0 && (
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>What you'll learn</h2>
								<ol className={watch.learnList} data-academy-learn-list>
									{session.learn.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ol>
							</section>
						)}

						{session.resources.length > 0 && (
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>Resources</h2>
								<ul className={watch.linkList}>
									{session.resources.map((resource) => (
										<li key={resource.title}>
											<a
												className={watch.linkRow}
												data-kinds={hasKinds ? "true" : "false"}
												href="#resource"
											>
												{hasKinds && (
													<span className={watch.linkKind}>
														{resource.category === "other"
															? ""
															: resource.category}
													</span>
												)}
												<span className={watch.linkBody}>
													<span className={watch.linkName} data-name>
														{resource.title}
													</span>
													{resource.description && (
														<span className={watch.linkNote}>
															{resource.description}
														</span>
													)}
												</span>
												<span
													className={watch.linkArrow}
													data-arrow
													aria-hidden="true"
												>
													↗
												</span>
											</a>
										</li>
									))}
								</ul>
							</section>
						)}

						{session.cast.length > 0 && (
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>Cast</h2>
								<ul className={watch.castGrid}>
									{session.cast.map((person) => (
										<li key={person.name}>
											<a className={watch.castCard} href="#person">
												{person.portrait ? (
													<img
														className={watch.castAvatar}
														src={person.portrait}
														alt=""
														width="72"
														height="72"
													/>
												) : (
													<span
														className={`${watch.castAvatar} ${watch.castInitials}`}
														aria-hidden="true"
													>
														{initials(person.name)}
													</span>
												)}
												<h3 className={watch.castName} data-name>
													{person.name}
												</h3>
												<p className={watch.castMeta}>{person.role}</p>
												{person.handle && (
													<p className={watch.castMeta}>@{person.handle}</p>
												)}
											</a>
										</li>
									))}
								</ul>
							</section>
						)}

						{session.chapters.length > 0 && (
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>Jump to a chapter</h2>
								<ol className={watch.chapterList}>
									{session.chapters.map((chapter) => (
										<li key={chapter.time}>
											<a className={watch.chapterLink} href="#chapter">
												<span className={watch.chapterTime}>
													{chapter.time}
												</span>
												<span className={watch.chapterName}>
													{chapter.title}
												</span>
											</a>
										</li>
									))}
								</ol>
							</section>
						)}

						{session.transcript.length > 0 && (
							<section className={watch.section}>
								<h2 className={watch.sectionTitle}>Transcript</h2>
								<p className={watch.transcriptNote}>
									Generated from English captions. Select a timestamp to jump to
									that moment.
								</p>
								<div className={watch.transcript}>
									<div>
										<label
											htmlFor="story-transcript"
											className={watch.fieldLabel}
										>
											Search transcript
										</label>
										<div className={watch.search}>
											<input
												id="story-transcript"
												type="search"
												placeholder="Search transcript..."
												className={watch.searchInput}
											/>
											<svg
												className={watch.searchIcon}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth="2"
													d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
												/>
											</svg>
										</div>
										<p className={watch.searchSummary} role="status" />
									</div>
									{/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard */}
									<div
										className={watch.transcriptContainer}
										role="region"
										aria-label="Transcript text"
										tabIndex={0}
									>
										<div className={watch.transcriptBody}>
											<section>
												{session.transcript.map((cue) => (
													<p
														key={cue.time}
														className={watch.transcriptParagraph}
													>
														<a
															className={watch.transcriptTimestampLink}
															href="#t"
															aria-label={`Jump to ${cue.time}`}
														>
															<span className={watch.transcriptTimestamp}>
																{cue.time}
															</span>
														</a>
														<span>{cue.text}</span>
													</p>
												))}
											</section>
										</div>
									</div>
								</div>
							</section>
						)}

						<section className={watch.section}>
							<div className={watch.comments}>
								<h2 className={watch.sectionTitle}>Comments (0)</h2>
								<div className={watch.commentList}>
									<p className={watch.transcriptNote}>
										No comments yet. Be the first to start the discussion.
									</p>
								</div>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
};

const recorded: Session = {
	title: "Debugging a Cilium network policy that drops DNS",
	show: "Rawkode Live",
	date: "6 Nov 2026",
	runtime: "1h 42m",
	kind: "Tutorial",
	still: stills.serviceMesh,
	lede: "A default-deny policy looks right, the pods are healthy, and nothing can resolve a name.",
	description: [
		"We reproduce the failure in a kind cluster, follow a DNS query through the datapath with Hubble, and fix the policy without opening more than the workload needs.",
	],
	learn: [
		"How Cilium evaluates egress policy for traffic to CoreDNS.",
		"How to follow a dropped packet with Hubble and the policy verdict log.",
		"How to allow DNS with a rule that still denies everything else.",
	],
	resources: [
		{
			title: "Cilium network policy documentation",
			category: "documentation",
		},
		{
			title: "The cluster and manifests from this session",
			description: "A kind configuration and the three policies we wrote.",
			category: "code",
		},
		{ title: "Hubble CLI reference", category: "other" },
	],
	cast: [
		{
			name: "David Flanagan",
			role: "Host",
			handle: "rawkode",
			portrait: stills.controlPlane,
		},
		{ name: "Liz Rice", role: "Guest", handle: "lizrice" },
		{ name: "Duffie Cooley", role: "Guest" },
		{ name: "Thomas Graf", role: "Guest" },
	],
	technologies: ["Cilium", "Kubernetes", "eBPF"],
	chapters: [
		{ time: "0:00", title: "Introductions" },
		{ time: "6:18", title: "Reproducing the failure" },
		{ time: "31:45", title: "Reading the verdict log" },
		{ time: "55:36", title: "Writing the fix" },
	],
	transcript: [
		{
			time: "0:00",
			text: "Welcome back. Today we have a cluster where every pod is healthy and nothing can resolve a name.",
		},
		{
			time: "2:41",
			text: "Quick introductions first, then we will get the cluster up and break it on purpose.",
		},
		{
			time: "6:18",
			text: "Here is the policy. It denies all egress by default, which is what you want, and it forgets about DNS.",
		},
		{
			time: "11:52",
			text: "Hubble shows the query leaving the pod and the verdict: dropped, policy denied.",
		},
		{
			time: "17:30",
			text: "The DNS proxy only sees traffic that a rule sends to it, so the rule has to exist first.",
		},
		{
			time: "24:07",
			text: "Let's write the smallest rule that lets this workload talk to CoreDNS and nothing else.",
		},
		{
			time: "31:45",
			text: "Same query again. Forwarded this time, and the name resolves.",
		},
		{
			time: "38:20",
			text: "Now the part people skip: checking that everything else is still denied.",
		},
	],
	upNext: [
		{
			title: "Hands-on with the Gateway API and Envoy Gateway",
			runtime: "1h 18m",
			still: stills.apiServer,
		},
		{
			title: "Klustered: a control plane that will not elect a leader",
			runtime: "58 min",
			still: stills.controlPlane,
		},
		{
			title: "Hands-on introduction to Kueue",
			runtime: "1h 2m",
			still: stills.serviceMesh,
		},
	],
	total: 175,
};

/** A recorded session with everything the content layer can supply. */
export const Recorded: Story = {
	render: () => <Workbench session={recorded} />,
};

/** No transcript, no resources, no show, one cast member. */
export const Minimal: Story = {
	tags: ["!visual", "!visual-mobile"],
	render: () => (
		<Workbench
			session={{
				title: "Hands-on introduction to Kueue",
				date: "17 Jul 2026",
				runtime: "1h 2m",
				kind: "Recorded session",
				still: stills.apiServer,
				description: [
					"Kueue is a Kubernetes-native job queueing system. We install it, define quotas, and watch it decide which jobs run.",
				],
				learn: [],
				resources: [],
				cast: [{ name: "David Flanagan", role: "Host", handle: "rawkode" }],
				technologies: ["Kueue"],
				chapters: [],
				transcript: [],
				upNext: [],
			}}
		/>
	),
};

/** A scheduled stream: the notice and "Notify me" sit under the title. */
export const Upcoming: Story = {
	tags: ["!visual", "!visual-mobile"],
	render: () => (
		<Workbench
			session={{
				...recorded,
				title: "Make Your Shell Magical with Atuin",
				date: "11 Nov 2026",
				runtime: "Upcoming",
				kind: "Live session",
				status: "Upcoming",
				scheduled: "Wednesday, 11 November 2026 at 17:00 UTC",
				still: stills.controlPlane,
				lede: undefined,
				description: [
					"Shell history, agent sessions and scripts, synced and searchable across every machine you work on.",
				],
				learn: [],
				resources: [],
				chapters: [],
				transcript: [],
				technologies: ["Atuin"],
			}}
		/>
	),
};
