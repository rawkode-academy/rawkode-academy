import { css, cva, sva } from "../../styled-system/css";

/**
 * The Arcade component vocabulary.
 *
 * Everything visual in `src/**` comes from this file. There are no `<style>`
 * blocks anywhere in the project: Panda cannot see them, which is how the
 * previous implementation ended up with 229 raw `var(--…)` references against a
 * palette that existed twice. `src/tests/design-tokens.test.ts` fails the build
 * if one comes back.
 *
 * See DESIGN.md for the rules these encode.
 */

/* ---------------------------------------------------------------- layout -- */

export const shell = css({
	maxW: "content",
	mx: "auto",
	px: "pageSm",
	w: "full",
});

export const shellWide = css({
	maxW: "wide",
	mx: "auto",
	px: "pageSm",
	w: "full",
});

export const stack = cva({
	base: { display: "flex", flexDirection: "column", minWidth: "0" },
	variants: {
		gap: {
			tight: { gap: "2" },
			snug: { gap: "3" },
			base: { gap: "4" },
			loose: { gap: "5" },
			section: { gap: "stack" },
		},
	},
	defaultVariants: { gap: "base" },
});

export const row = cva({
	base: { display: "flex", alignItems: "center" },
	variants: {
		gap: {
			tight: { gap: "2" },
			base: { gap: "3" },
			loose: { gap: "4" },
		},
		justify: {
			start: { justifyContent: "flex-start" },
			between: { justifyContent: "space-between" },
			end: { justifyContent: "flex-end" },
		},
		wrap: { true: { flexWrap: "wrap" } },
	},
	defaultVariants: { gap: "base", justify: "start" },
});

/* --------------------------------------------------------------- surface -- */

/**
 * The one container primitive. Nesting beyond one level is not permitted; use
 * `flush` for the inner tier so the page never grows a third surface tone.
 */
export const stage = cva({
	base: {
		bg: "surface",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderColor: "rule",
		borderRadius: "lg",
		minWidth: "0",
	},
	variants: {
		tone: {
			default: {},
			raised: { bg: "surfaceRaised" },
			live: { borderColor: "live", bg: "surface" },
			flush: { bg: "transparent", borderColor: "transparent" },
		},
		pad: {
			none: { p: "0" },
			compact: { p: "3" },
			base: { p: "4" },
			comfortable: { p: "card" },
		},
	},
	defaultVariants: { tone: "default", pad: "base" },
});

/* ------------------------------------------------------- rules and slugs -- */

/**
 * The signature structural device: a 2px rule carrying an inline mono slug.
 * This replaces the banned eyebrow. A slug carries a real identifier
 * ("FMT-03 · 4 TEAMS"); a category name ("TONIGHT'S FORMATS") is an eyebrow and
 * does not belong here.
 */
export const sectionRule = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "baseline",
	columnGap: "4",
	rowGap: "2",
	borderTopWidth: "rule",
	borderTopStyle: "solid",
	borderTopColor: "ruleStrong",
	pt: "3",
	mb: "5",
});

export const slug = cva({
	base: {
		textStyle: "label",
		color: "inkSoft",
		display: "inline-flex",
		alignItems: "center",
		gap: "2",
		// Deliberately wrapping. A tracked uppercase label is long, and
		// `nowrap` here pushed the whole page wider than a 390px viewport.
		minWidth: "0",
	},
	variants: {
		wrap: {
			/** Only for a short identifier that must stay on one line. */
			never: { whiteSpace: "nowrap" },
		},
		tone: {
			default: {},
			live: { color: "live" },
			action: { color: "action" },
			crowd: { color: "crowd" },
			closed: { color: "closed" },
		},
	},
	defaultVariants: { tone: "default" },
});

export const hairline = css({
	borderTopWidth: "hairline",
	borderTopStyle: "solid",
	borderTopColor: "rule",
});

/* ------------------------------------------------------------ typography -- */

export const text = cva({
	base: {},
	variants: {
		style: {
			display: { textStyle: "display" },
			headline: { textStyle: "headline" },
			title: { textStyle: "title" },
			body: { textStyle: "body" },
			bodySm: { textStyle: "bodySm" },
			label: { textStyle: "label" },
			tally: { textStyle: "tally" },
		},
		tone: {
			ink: { color: "ink" },
			soft: { color: "inkSoft" },
			mute: { color: "inkMute" },
			live: { color: "live" },
			action: { color: "action" },
			wrong: { color: "wrong" },
			crowd: { color: "crowd" },
		},
		measure: {
			prose: { maxW: "prose" },
			narrow: { maxW: "measure" },
		},
	},
	defaultVariants: { style: "body", tone: "ink" },
});

/* -------------------------------------------------------------- controls -- */

export const control = cva({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "2",
		textStyle: "label",
		borderRadius: "md",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderColor: "transparent",
		minH: "control",
		px: "4",
		transitionProperty: "colors",
		transitionDuration: "fast",
		transitionTimingFunction: "standard",
		_disabled: { opacity: "0.45", pointerEvents: "none" },
	},
	variants: {
		tone: {
			/** Primary action, navigation, submit. */
			action: {
				bg: "action",
				color: "ground",
				_hover: { bg: "ink" },
			},
			/**
			 * Reserved for actions that change broadcast state: open the room,
			 * advance the round, reveal the answer. Never navigation.
			 */
			live: {
				bg: "live",
				color: "ground",
				_hover: { bg: "ink" },
			},
			quiet: {
				bg: "transparent",
				color: "ink",
				borderColor: "ruleStrong",
				_hover: { borderColor: "ink", bg: "surfaceRaised" },
			},
			danger: {
				bg: "transparent",
				color: "wrong",
				borderColor: "wrong",
				_hover: { bg: "rustDim" },
			},
		},
		size: {
			sm: { minH: "touch", px: "3" },
			base: {},
			block: { width: "full" },
		},
	},
	defaultVariants: { tone: "action", size: "base" },
});

export const field = cva({
	base: {
		minWidth: "0",
		bg: "ground",
		color: "ink",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderColor: "ruleStrong",
		borderRadius: "sm",
		textStyle: "body",
		px: "3",
		minH: "control",
		width: "full",
		transitionProperty: "colors",
		transitionDuration: "fast",
		transitionTimingFunction: "standard",
		_hover: { borderColor: "inkMute" },
		_focusVisible: { borderColor: "action" },
		_placeholder: { color: "inkMute" },
		_invalid: { borderColor: "wrong" },
	},
	variants: {
		variant: {
			text: {},
			/** Room codes are identifiers, so they are set at tally scale. */
			code: {
				fontFamily: "mono",
				fontSize: "title",
				fontWeight: "semibold",
				letterSpacing: "code",
				textTransform: "uppercase",
				textAlign: "center",
				py: "2",
			},
		},
	},
	defaultVariants: { variant: "text" },
});

export const fieldLabel = css({
	textStyle: "label",
	color: "inkSoft",
	display: "block",
	mb: "2",
});

/* --------------------------------------------------------- running order -- */

/**
 * The default presentation for any sequence: formats, rounds, standings,
 * players, queues. Ruled rows, not a card grid.
 */
export const runningOrder = sva({
	slots: ["root", "item", "index", "title", "meta", "action"],
	base: {
		root: {
			display: "flex",
			flexDirection: "column",
			borderTopWidth: "hairline",
			borderTopStyle: "solid",
			borderTopColor: "rule",
		},
		item: {
			display: "grid",
			gridTemplateColumns: { base: "auto 1fr", sm: "auto 1fr auto" },
			alignItems: { base: "start", sm: "center" },
			columnGap: "4",
			rowGap: "2",
			borderBottomWidth: "hairline",
			borderBottomStyle: "solid",
			borderBottomColor: "rule",
			py: "3",
			minH: "touch",
			textAlign: "left",
			bg: "transparent",
			width: "full",
			transitionProperty: "colors",
			transitionDuration: "fast",
			transitionTimingFunction: "standard",
			_hover: { bg: "surface" },
		},
		index: {
			textStyle: "label",
			color: "inkMute",
			fontVariantNumeric: "tabular-nums",
		},
		title: { textStyle: "title", color: "ink", minWidth: "0" },
		meta: {
			textStyle: "label",
			color: "inkMute",
			gridColumn: "2",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
		action: {
			textStyle: "label",
			color: "action",
			whiteSpace: "nowrap",
			// Below `sm` the action drops under the title rather than
			// competing with it for a 390px line.
			gridColumn: { base: "2", sm: "auto" },
			justifySelf: { base: "start", sm: "end" },
		},
	},
	variants: {
		state: {
			default: {},
			selected: {
				item: {
					bg: "actionDim",
					borderBottomColor: "action",
				},
				index: { color: "action" },
			},
			live: {
				item: { bg: "liveDim", borderBottomColor: "live" },
				index: { color: "live" },
				action: { color: "live" },
			},
		},
	},
	defaultVariants: { state: "default" },
});

/* ------------------------------------------------------------ scoreboard -- */

/**
 * Leading position is marked by a rule *and* a label, never colour alone
 * (PRODUCT.md, accessibility: colour is never the only carrier of state).
 */
export const scoreboard = sva({
	slots: ["root", "row", "rank", "identity", "name", "flag", "score", "delta"],
	base: {
		root: { display: "flex", flexDirection: "column", minWidth: "0" },
		row: {
			display: "grid",
			gridTemplateColumns: "auto minmax(0, 1fr) auto",
			alignItems: "center",
			gap: "3",
			py: "2",
			px: "3",
			borderBottomWidth: "hairline",
			borderBottomStyle: "solid",
			borderBottomColor: "rule",
			minWidth: "0",
		},
		rank: {
			textStyle: "label",
			color: "inkMute",
			fontVariantNumeric: "tabular-nums",
		},
		identity: {
			display: "flex",
			alignItems: "center",
			gap: "2",
			minWidth: "0",
		},
		name: {
			textStyle: "bodySm",
			fontWeight: "semibold",
			color: "ink",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		flag: { textStyle: "label", color: "live" },
		score: {
			fontFamily: "mono",
			fontSize: "title",
			fontWeight: "semibold",
			fontVariantNumeric: "tabular-nums",
			color: "ink",
		},
		delta: { textStyle: "label", color: "correct" },
	},
	variants: {
		position: {
			default: {},
			/**
			 * Marked by surface tint, a stronger rule, the LEAD flag and an
			 * amber score. No side stripe: a coloured left border on a list
			 * row is decoration, and colour is never the only carrier.
			 */
			leading: {
				row: { bg: "liveDim", borderBottomColor: "live" },
				rank: { color: "live" },
				score: { color: "live" },
			},
		},
		density: {
			base: {},
			compact: {
				row: { py: "1" },
				name: { textStyle: "label", textTransform: "none" },
				score: { fontSize: "body" },
			},
		},
	},
	defaultVariants: { position: "default", density: "base" },
});

/* ---------------------------------------------------------------- status -- */

export const statusPill = cva({
	base: {
		display: "inline-flex",
		alignItems: "center",
		gap: "2",
		textStyle: "label",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderColor: "rule",
		borderRadius: "xs",
		px: "2",
		py: "1",
		color: "inkSoft",
	},
	variants: {
		state: {
			connected: { color: "correct", borderColor: "spruceDim" },
			connecting: { color: "live", borderColor: "amberDim" },
			reconnecting: { color: "live", borderColor: "amberDim" },
			offline: { color: "closed", borderColor: "rustDim" },
		},
	},
	defaultVariants: { state: "connecting" },
});

/** The dot inside a status pill. Paired with text, never used alone. */
export const statusDot = cva({
	base: {
		width: "2",
		height: "2",
		borderRadius: "pill",
		bg: "currentColor",
		flexShrink: "0",
	},
	variants: {
		pulse: {
			true: {
				animation: "onAir",
				animationDuration: "slow",
				animationIterationCount: "infinite",
				animationTimingFunction: "standard",
			},
		},
	},
});

/* ----------------------------------------------------------- answer grid -- */

export const choice = cva({
	base: {
		minWidth: "0",
		overflowWrap: "anywhere",
		display: "flex",
		alignItems: "center",
		gap: "3",
		width: "full",
		minH: "touch",
		textAlign: "left",
		bg: "surface",
		color: "ink",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderColor: "ruleStrong",
		borderRadius: "sm",
		px: "3",
		py: "3",
		textStyle: "body",
		transitionProperty: "colors",
		transitionDuration: "fast",
		transitionTimingFunction: "standard",
		_hover: { borderColor: "ink" },
		_disabled: { opacity: "0.5", pointerEvents: "none" },
	},
	variants: {
		state: {
			idle: {},
			selected: { borderColor: "action", bg: "actionDim" },
			correct: { borderColor: "correct", bg: "spruceDim" },
			wrong: { borderColor: "wrong", bg: "rustDim" },
		},
	},
	defaultVariants: { state: "idle" },
});

/** The mono key on the left of a choice: A / B / C / D. */
export const choiceKey = css({
	textStyle: "label",
	color: "inkMute",
	borderWidth: "hairline",
	borderStyle: "solid",
	borderColor: "rule",
	borderRadius: "xs",
	width: "6",
	height: "6",
	display: "grid",
	placeItems: "center",
	flexShrink: "0",
});

/* ------------------------------------------------------------- feedback -- */

export const notice = cva({
	base: {
		display: "flex",
		alignItems: "flex-start",
		gap: "2",
		textStyle: "bodySm",
		borderWidth: "hairline",
		borderStyle: "solid",
		borderRadius: "sm",
		px: "3",
		py: "2",
	},
	variants: {
		tone: {
			error: { borderColor: "wrong", bg: "rustDim", color: "ink" },
			live: { borderColor: "live", bg: "amberDim", color: "ink" },
			info: { borderColor: "action", bg: "actionDim", color: "ink" },
		},
	},
	defaultVariants: { tone: "info" },
});

/** Panda's own pattern, re-exported so callers have one import site. */
export { visuallyHidden } from "../../styled-system/patterns";
