import {
	academyCourse,
	academyDocument,
	academyForms,
	academyLayout,
	academyMarketing,
	academyPage,
	academyReference,
} from "@rawkodeacademy/design-system";
import type { Meta, StoryObj } from "@storybook/react";
import { canvas, Specimen } from "./specimen";

const meta = {
	title: "Design System/Surfaces and type",
	// Screenshot baselines in visual/__screenshots__ (bun run test:visual).
	tags: ["visual"],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"Framed surfaces (`panelSurface`, `linkedPanel`, `pill` in `src/styles/surface.ts`), the text input (`inputField` in `src/styles/field.ts`) and the shared type steps (`src/styles/type.ts`), each shown through a recipe slot that spreads it.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const row = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "0.75rem",
} as const;
const columns = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
	gap: "1.5rem",
} as const;
const field = { display: "grid", gap: "0.5rem" } as const;

export const Panels: Story = {
	render: () => {
		const layout = academyLayout();
		const doc = academyDocument();
		const marketing = academyMarketing();
		const reference = academyReference();
		return (
			<div style={canvas}>
				<Specimen label="linkedPanel: an independent linked item. Hover and tab to it.">
					<div style={columns}>
						<a className={layout.card} href="#course">
							<div className={layout.cardBody}>
								<h3 className={layout.cardTitle}>Complete guide to Zitadel</h3>
								<p className={layout.meta}>14 lessons · 3h 20m of video</p>
							</div>
						</a>
						<a className={doc.relatedCard} href="#article">
							<p className={doc.kicker}>Next in this series</p>
							<h3 className={doc.cardTitle}>
								Admission webhooks that fail closed
							</h3>
						</a>
					</div>
				</Specimen>
				<Specimen label="panelSurface: a static panel that holds a task or an aside">
					<div style={columns}>
						<aside className={layout.sidebar}>
							<h3 className={layout.cardTitle}>In this session</h3>
							<p className={layout.meta}>
								Hubble, CoreDNS, CiliumNetworkPolicy
							</p>
						</aside>
						<div className={marketing.card}>
							<h3 className={layout.cardTitle}>Sponsor a live session</h3>
							<p className={marketing.cardBody}>
								Your team builds with David on air for ninety minutes.
							</p>
						</div>
					</div>
				</Specimen>
				<Specimen label="pill: the slot chooses fill, colour and font">
					<div style={row}>
						<span className={layout.tag}>Kubernetes</span>
						<a className={doc.tag} href="#tag">
							ebpf
						</a>
						<span className={reference.tag}>Stable since 1.36</span>
						<span className={marketing.pill}>Remote, worldwide</span>
					</div>
				</Specimen>
			</div>
		);
	},
};

export const Fields: Story = {
	render: () => {
		const forms = academyForms();
		const layout = academyLayout();
		const page = academyPage();
		return (
			<div style={canvas}>
				<Specimen label="inputField: one surface and one set of states; the slot sets the metrics">
					<div style={columns}>
						<label style={field}>
							<span className={forms.label}>Work email</span>
							<input
								className={forms.input}
								type="email"
								placeholder="you@company.dev"
							/>
						</label>
						<label style={field}>
							<span className={forms.label}>Filter technologies</span>
							<input
								className={layout.input}
								type="search"
								placeholder="Cilium, Talos, Zitadel"
							/>
						</label>
						<label style={field}>
							<span className={forms.label}>Search videos</span>
							<input
								className={page.input}
								type="search"
								defaultValue="gateway api"
							/>
						</label>
					</div>
				</Specimen>
				<Specimen label="states: invalid and disabled come with the fragment">
					<div style={columns}>
						<label style={field}>
							<span className={forms.label}>Work email</span>
							<input
								className={forms.input}
								type="email"
								defaultValue="david@"
								aria-invalid="true"
							/>
						</label>
						<label style={field}>
							<span className={forms.label}>Company</span>
							<input
								className={forms.input}
								type="text"
								defaultValue="Rawkode Academy"
								disabled
							/>
						</label>
					</div>
				</Specimen>
			</div>
		);
	},
};

export const Type: Story = {
	render: () => {
		const page = academyPage();
		const layout = academyLayout();
		const course = academyCourse();
		return (
			<div style={canvas}>
				<Specimen label="sectionTitle + ledeText">
					<h2 className={page.sectionTitle}>Recently published</h2>
					<p className={page.lede}>
						One stream, in order: sessions, articles, news and courses as they
						land.
					</p>
				</Specimen>
				<Specimen label="headingLg">
					<h3 className={layout.sectionTitle}>What you will build</h3>
				</Specimen>
				<Specimen label="headingMd">
					<h4 className={layout.cardTitle}>Complete guide to Zitadel</h4>
				</Specimen>
				<Specimen label="cardTitle">
					<h4 className={page.cardTitle}>
						Hands-on with the Gateway API and Envoy Gateway
					</h4>
				</Specimen>
				<Specimen label="kicker + monoMeta">
					<p className={course.kicker}>Course</p>
					<p className={page.cardMeta}>
						<span>1h 2m</span>
						<span aria-hidden="true">·</span>
						<time>6 Nov 2026</time>
					</p>
				</Specimen>
			</div>
		);
	},
};
