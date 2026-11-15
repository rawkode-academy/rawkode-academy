import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

const meta = {
	title: "Design System/Tokens",
	// Screenshot baselines in visual/__screenshots__ (bun run test:visual).
	tags: ["visual"],
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"The Academy semantic tokens as they resolve in the active colour scheme. Values come from `packages/design-system/panda.config.ts`; switch the theme in the toolbar.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Specimen layout only. Product styles live in design-system recipes.
const page: CSSProperties = {
	display: "grid",
	gap: "3rem",
	padding: "3rem var(--spacing-academy-gutter)",
	background: "var(--colors-academy-canvas)",
	color: "var(--colors-academy-text)",
	fontFamily: "var(--fonts-academy-text)",
};
const heading: CSSProperties = {
	margin: "0 0 1rem",
	fontFamily: "var(--fonts-academy-display)",
	fontSize: "1.5rem",
	fontWeight: 700,
};
const grid: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
	gap: "1rem",
};
const mono: CSSProperties = {
	fontFamily: "var(--fonts-academy-mono)",
	fontSize: "0.75rem",
	color: "var(--colors-academy-text-muted)",
};

const colourGroups: Array<[string, Array<[string, string]>]> = [
	[
		"Canvas and text",
		[
			["academy.canvas", "canvas"],
			["academy.ground", "ground"],
			["academy.panel", "panel"],
			["academy.border", "border"],
			["academy.text", "text"],
			["academy.textSoft", "text-soft"],
			["academy.textMuted", "text-muted"],
		],
	],
	[
		"Accent",
		[
			["academy.accent", "accent"],
			["academy.accentHover", "accent-hover"],
			["academy.accentForeground", "accent-foreground"],
		],
	],
	[
		"Ink surfaces",
		[
			["academy.ink", "ink"],
			["academy.inkRaised", "ink-raised"],
			["academy.inkBorder", "ink-border"],
			["academy.inkText", "ink-text"],
			["academy.inkTextMuted", "ink-text-muted"],
			["academy.inkAccent", "ink-accent"],
		],
	],
	[
		"Status (a real state, never decoration)",
		[
			["academy.statusSpruce", "status-spruce"],
			["academy.statusAmber", "status-amber"],
			["academy.statusRust", "status-rust"],
			["academy.statusSky", "status-sky"],
			["academy.statusViolet", "status-violet"],
		],
	],
];

const typeScale: Array<[string, string, CSSProperties]> = [
	[
		"academy-poster",
		"Learn in public",
		{
			fontSize: "var(--font-sizes-academy-poster)",
			lineHeight: 0.9,
			letterSpacing: "-0.05em",
			fontWeight: 800,
		},
	],
	[
		"academy-masthead",
		"Videos",
		{
			fontSize: "var(--font-sizes-academy-masthead)",
			lineHeight: 0.95,
			letterSpacing: "-0.035em",
			fontWeight: 800,
		},
	],
	[
		"academy-section",
		"Latest sessions",
		{
			fontSize: "var(--font-sizes-academy-section)",
			lineHeight: 1.04,
			letterSpacing: "-0.035em",
			fontWeight: 700,
		},
	],
	[
		"academy-title",
		"Debugging a broken cluster",
		{
			fontSize: "var(--font-sizes-academy-title)",
			lineHeight: 1.15,
			letterSpacing: "-0.02em",
			fontWeight: 700,
		},
	],
];

export const Colour: Story = {
	render: () => (
		<div style={page}>
			{colourGroups.map(([title, tokens]) => (
				<section key={title}>
					<h2 style={heading}>{title}</h2>
					<div style={grid}>
						{tokens.map(([name, cssName]) => (
							<div key={name} style={{ display: "grid", gap: "0.5rem" }}>
								<div
									style={{
										height: "4.5rem",
										borderRadius: "var(--radii-academy-m)",
										border: "1px solid var(--colors-academy-border)",
										background: `var(--colors-academy-${cssName})`,
									}}
								/>
								<code style={mono}>{name}</code>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	),
};

export const Type: Story = {
	render: () => (
		<div style={page}>
			{typeScale.map(([token, sample, style]) => (
				<div
					key={token}
					style={{ display: "grid", gap: "0.5rem", minWidth: 0 }}
				>
					<code style={mono}>{token}</code>
					<p
						style={{
							margin: 0,
							fontFamily: "var(--fonts-academy-display)",
							overflowWrap: "anywhere",
							...style,
						}}
					>
						{sample}
					</p>
				</div>
			))}
			<div style={{ display: "grid", gap: "0.5rem", maxWidth: "680px" }}>
				<code style={mono}>academy-text · academy-reading</code>
				<p style={{ margin: 0, fontSize: "1.125rem", lineHeight: 1.65 }}>
					Rawkode Academy makes complex cloud-native systems easier to learn
					without pretending they are simple. Reading copy sets at 680px so a
					line holds about seventy characters.
				</p>
				<code style={mono}>
					academy-mono · 2026-11-09 · 42:18 · Intermediate
				</code>
			</div>
		</div>
	),
};
