import {
	academyPage,
	academyRelatedContent,
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
					"The pieces of a video card, from `src/styles/media.ts` and `src/styles/type.ts`: `videoFrame` (the 16:9 still), `coverImage` / `coverImageZoom`, `runtimeBadge`, `cardTitle` and `monoMeta`. `academyPage.card` is the one video card (library, show and technology rails). A scheduled stream is a horizontal feature. The watch page is in `Pages/Watch workbench`.",
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
