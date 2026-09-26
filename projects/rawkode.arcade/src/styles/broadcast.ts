import { css, cva, sva } from "../../styled-system/css";

/**
 * The broadcast scale.
 *
 * `/display/[code]` is composited into a live stream. It is read at one to
 * three metres, re-encoded to 720p, and sometimes keyed behind a lower third.
 * It does not share components with the phone UI, because a 40cm reading
 * distance and a 3m one are not the same design problem — the previous
 * implementation rendered both from the same styles at the same sizes.
 *
 * Rules for this file (DESIGN.md §4):
 *   - Size in `vmin`. The browser is a video source; its root font size is not
 *     the viewer's distance.
 *   - Two text tones only, ink and live. inkSoft and inkMute do not survive
 *     the encoder.
 *   - Rules are 2px minimum. Hairlines disappear under compression.
 *   - Keep the bottom `castLower` band clear for the stream's lower third.
 */

export const castStage = css({
	position: "fixed",
	inset: "0",
	bg: "ground",
	color: "ink",
	display: "grid",
	gridTemplateRows: "auto 1fr auto",
	p: "castSafe",
	pb: "castLower",
	overflow: "hidden",
});

/** The persistent on-air bar. Full-bleed rule, format slug, room, clock. */
export const castBar = sva({
	slots: ["root", "group", "tally", "label"],
	base: {
		root: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "castSafe",
			borderBottomWidth: "rule",
			borderBottomStyle: "solid",
			borderBottomColor: "ruleStrong",
			pb: "3",
		},
		group: { display: "flex", alignItems: "center", gap: "4" },
		tally: {
			textStyle: "castLabel",
			color: "live",
			fontVariantNumeric: "tabular-nums",
		},
		label: { textStyle: "castLabel", color: "ink" },
	},
	variants: {
		state: {
			open: {},
			closed: { tally: { color: "closed" }, root: { borderBottomColor: "closed" } },
		},
	},
	defaultVariants: { state: "open" },
});

export const castBody = css({
	display: "grid",
	alignContent: "center",
	justifyItems: "start",
	gap: "4",
	minHeight: "0",
});

export const castPrompt = css({
	textStyle: "castHeadline",
	color: "ink",
	maxWidth: "castMeasure",
	textWrap: "balance",
});

export const castHero = css({
	textStyle: "castHero",
	color: "ink",
	lineHeight: "flat",
});

/** Team standings as read off the stream. Numbers carry the frame. */
export const castScores = sva({
	slots: ["root", "row", "name", "score"],
	base: {
		root: {
			display: "flex",
			alignItems: "flex-end",
			flexWrap: "wrap",
			gap: "castSafe",
			borderTopWidth: "rule",
			borderTopStyle: "solid",
			borderTopColor: "ruleStrong",
			pt: "3",
			width: "full",
		},
		row: { display: "grid", gap: "1", minWidth: "0", flex: "1" },
		name: {
			textStyle: "castLabel",
			color: "ink",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		score: {
			textStyle: "castTally",
			color: "ink",
			fontVariantNumeric: "tabular-nums",
		},
	},
	variants: {
		position: {
			default: {},
			leading: { score: { color: "live" }, name: { color: "live" } },
		},
	},
	defaultVariants: { position: "default" },
});

/**
 * Countdown ring. Animates a registered `--arcade-sweep` angle so the sweep
 * runs on the compositor rather than repainting a layout property.
 */
export const castClock = cva({
	base: {
		display: "grid",
		placeItems: "center",
		width: "castRing",
		height: "castRing",
		borderRadius: "pill",
		backgroundImage: "castSweep",
		position: "relative",
		_before: {
			content: '""',
			position: "absolute",
			inset: "castRingInset",
			borderRadius: "pill",
			bg: "ground",
		},
	},
	variants: {
		running: {
			true: {
				animation: "sweep",
				animationTimingFunction: "linear",
				animationFillMode: "forwards",
			},
		},
	},
});

export const castClockValue = css({
	position: "relative",
	textStyle: "castTitle",
	fontFamily: "mono",
	color: "ink",
	fontVariantNumeric: "tabular-nums",
});
