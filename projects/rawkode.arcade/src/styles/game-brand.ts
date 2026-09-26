import { css, cva, sva } from "../../styled-system/css";

/**
 * Per-format visual grammar. These variants deliberately change silhouette,
 * rhythm, and information shape rather than assigning each show a hue. That
 * keeps an encoded, monochrome broadcast recognisable at a glance.
 */
export const gameMark = cva({
	base: {
		display: "inline-grid",
		placeItems: "center",
		width: "6",
		height: "6",
		color: "ink",
		flexShrink: "0",
	},
	variants: {
		motif: {
			diff: { color: "action" },
			wheel: { color: "live" },
			ladder: { color: "ink" },
			race: { color: "live" },
			matrix: { color: "action" },
			void: { color: "crowd" },
		},
		scale: {
			compact: { width: "5", height: "5" },
			base: {},
			cast: { width: "castRing", height: "castRing" },
		},
	},
	defaultVariants: { scale: "base" },
});

export const gameFrame = sva({
	slots: ["root", "meta", "board", "cell", "signal", "track", "marker"],
	base: {
		root: {
			display: "grid",
			gap: "3",
			minWidth: "0",
			color: "ink",
		},
		meta: {
			display: "flex",
			alignItems: "center",
			gap: "2",
			textStyle: "label",
			color: "inkSoft",
		},
		board: { minWidth: "0" },
		cell: {
			borderWidth: "hairline",
			borderStyle: "solid",
			borderColor: "ruleStrong",
			bg: "surface",
		},
		signal: { textStyle: "label", color: "live" },
		track: { borderColor: "ruleStrong" },
		marker: { bg: "ink", color: "ground" },
	},
	variants: {
		motif: {
			diff: {
				root: { borderTopWidth: "rule", borderTopStyle: "solid", borderTopColor: "action", pt: "3" },
				board: { display: "grid", gap: "1", fontFamily: "mono", textStyle: "bodySm" },
				cell: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "2", px: "2", py: "2" },
				signal: { color: "action" },
			},
			wheel: {
				root: { justifyItems: "center" },
				board: { display: "grid", justifyItems: "center", gap: "2" },
				cell: { borderRadius: "pill", px: "4", py: "2", fontFamily: "mono", textStyle: "title" },
				signal: { color: "live" },
			},
			ladder: {
				board: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "1" },
				cell: { minH: "6", display: "grid", placeItems: "center", fontFamily: "mono", textStyle: "label" },
				marker: { bg: "live", color: "ground", borderColor: "live" },
			},
			race: {
				board: { display: "grid", gap: "3" },
				track: {
					display: "grid",
					gridTemplateColumns: "auto 1fr auto",
					alignItems: "center",
					gap: "2",
					borderTopWidth: "rule",
					borderTopStyle: "dashed",
					pt: "2",
				},
				marker: { display: "grid", placeItems: "center", minH: "6", px: "2", fontFamily: "mono", textStyle: "label" },
			},
			matrix: {
				board: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "1" },
				cell: { minH: "6", display: "grid", placeItems: "center", fontFamily: "mono", textStyle: "label" },
				marker: { bg: "action", color: "ground", borderColor: "action" },
			},
			void: {
				root: { borderBottomWidth: "rule", borderBottomStyle: "solid", borderBottomColor: "crowd", pb: "3" },
				board: { display: "grid", gap: "2" },
				cell: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "2", px: "2", py: "2" },
				signal: { color: "crowd" },
			},
		},
		scale: {
			live: {},
			cast: {
				root: { gap: "castSafe", width: "full" },
				meta: { textStyle: "castLabel", color: "ink" },
				cell: { borderWidth: "rule" },
				signal: { textStyle: "castLabel", color: "live" },
				marker: { textStyle: "castLabel" },
			},
		},
	},
	defaultVariants: { scale: "live" },
});

export const gameBoardText = css({
	minWidth: "0",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
});

export const gameBoardTrack = css({
	position: "relative",
	height: "2",
	bg: "surfaceRaised",
	borderRadius: "pill",
	overflow: "hidden",
});

export const gameBoardTrackFill = css({
	display: "block",
	height: "full",
	bg: "live",
	transitionProperty: "size",
	transitionDuration: "base",
	transitionTimingFunction: "standard",
});
