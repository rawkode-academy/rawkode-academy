import type { Meta, StoryObj } from "@storybook/react";
import { button } from "@rawkodeacademy/design-system";
import { Button } from "@rawkodeacademy/design-system/vue";
import type { CSSProperties, ReactNode } from "react";
import { defineComponent, h } from "vue";
import { VueInReact } from "../components/vue-wrapper";

const meta = {
	title: "Design System/Button",
	parameters: {
		layout: "fullscreen",
		docs: {
			description: {
				component:
					"One recipe for every action. `button()` returns the class for an `<a>` or `<button>` in Astro, React and Vue; the Vue `Button` wraps it with the arrow, loading and disabled-link behaviour.",
			},
		},
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Specimen layout only. Product styles live in design-system recipes.
const surface = (ink: boolean): CSSProperties => ({
	display: "grid",
	gap: "2rem",
	padding: "3rem clamp(20px, 4vw, 48px)",
	background: ink
		? "var(--colors-academy-ink)"
		: "var(--colors-academy-canvas)",
	color: ink ? "var(--colors-academy-ink-text)" : "var(--colors-academy-text)",
	fontFamily: "var(--fonts-academy-text)",
});
const row: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "0.75rem",
};
const caption: CSSProperties = {
	margin: 0,
	fontFamily: "var(--fonts-academy-mono)",
	fontSize: "0.75rem",
	opacity: 0.7,
};

const Specimen = ({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) => (
	<div style={{ display: "grid", gap: "0.75rem" }}>
		<p style={caption}>{label}</p>
		<div style={row}>{children}</div>
	</div>
);

const Arrow = () => (
	<span data-part="arrow" aria-hidden="true">
		→
	</span>
);

export const Variants: Story = {
	render: () => (
		<>
			<div style={surface(false)}>
				<Specimen label="solid: the one thing to do next">
					<a className={button({ size: "lg" })} href="#solid">
						Watch the latest session <Arrow />
					</a>
					<button className={button()} type="button">
						Save preferences
					</button>
					<button className={button({ size: "sm" })} type="button">
						Sign in
					</button>
				</Specimen>
				<Specimen label="outline: a second action beside it">
					<a
						className={button({ variant: "outline", size: "lg" })}
						href="#outline"
					>
						Browse the library
					</a>
					<button className={button({ variant: "outline" })} type="button">
						Apply filters
					</button>
					<button
						className={button({ variant: "outline", size: "sm" })}
						type="button"
					>
						Copy link
					</button>
				</Specimen>
				<Specimen label="quiet: toolbar and in-panel controls">
					<button className={button({ variant: "quiet" })} type="button">
						Reset
					</button>
					<button
						className={button({ variant: "quiet" })}
						type="button"
						aria-pressed="true"
					>
						Preview
					</button>
					<button
						className={button({ variant: "quiet", icon: true })}
						type="button"
						aria-label="Close"
					>
						<svg
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							aria-hidden="true"
						>
							<path d="M4 4l8 8M12 4l-8 8" />
						</svg>
					</button>
				</Specimen>
				<Specimen label="states: pressed, disabled, full width">
					<button
						className={button({ variant: "outline" })}
						type="button"
						aria-pressed="true"
					>
						cgroup v2
					</button>
					<button
						className={button({ variant: "outline" })}
						type="button"
						aria-pressed="false"
					>
						cgroup v1
					</button>
					<button className={button()} type="button" disabled>
						Submitting
					</button>
					<div style={{ flexBasis: "100%", maxWidth: "24rem" }}>
						<button className={button({ fullWidth: true })} type="submit">
							Subscribe
						</button>
					</div>
				</Specimen>
			</div>
			<div style={surface(true)}>
				<Specimen label="ink: the second action on an ink surface">
					<a className={button({ size: "lg" })} href="#solid-ink">
						Watch the latest session <Arrow />
					</a>
					<a className={button({ variant: "ink", size: "lg" })} href="#ink">
						Browse the library
					</a>
				</Specimen>
			</div>
		</>
	),
};

const VueSpecimen = defineComponent({
	setup() {
		return () =>
			h("div", { style: { ...surface(false) } }, [
				h("div", { style: row }, [
					h(
						Button,
						{ href: "#vue", size: "lg", arrow: true },
						() => "Read the article",
					),
					h(Button, { variant: "outline", loading: true }, () => "Saving"),
					h(
						Button,
						{ href: "#blocked", variant: "outline", disabled: true },
						() => "Unavailable link",
					),
				]),
			]);
	},
});

/** The Vue component: arrow, loading and disabled-link behaviour. */
export const VueComponent: Story = {
	render: () => <VueInReact component={VueSpecimen} />,
};
