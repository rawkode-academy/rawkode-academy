import type { SystemStyleObject } from "../../styled-system/types";
import { focusRing } from "./focus";
import { coverImageZoom, videoFrame } from "./media";
import { scrollReveal } from "./motion";

/**
 * The ledger: the one row every chronological collection shares (the
 * homepage stream, Read, News). A date column led by the two-digit day as a
 * numeral, then kind, title and one sentence, with an optional 16:9 still
 * in a trailing column from `sm` up, separated by hairlines. The body is
 * flush with the gutter at every width.
 *
 * Markup contract:
 *
 *   <div class={list}>
 *     <a class={row} data-media="true|false">
 *       <time class={date}><strong>09</strong><span>Nov 2026</span></time>
 *       <span class={media}><img class={image} /></span>   (optional)
 *       <div class={body} data-body>
 *         <p class={kind}>…</p>
 *         <h3 class={title}>…</h3>
 *         <p class={description}>…</p>
 *       </div>
 *     </a>
 *   </div>
 *
 * Each fragment is spread whole into a slot. Do not add `_lg` or `_hover`
 * to a slot that spreads one: a spread is shallow and the slot's block
 * would replace the fragment's.
 */

/** A list whose rows are separated by hairlines. The rows draw their own bottom rule. */
export const ruledList = {
	display: "grid",
	borderTop: "hairline",
} as const satisfies SystemStyleObject;

export const ledgerRow = {
	display: "grid",
	// Every body starts on the gutter, still or not. A phone has no room
	// for a still beside the title, so the row is text-led there; from `sm`
	// the still takes a trailing column, as it does on wide screens.
	gridTemplateColumns: "minmax(0, 1fr)",
	// The body is placed in the first column after the still in the
	// second; dense flow lets it share the still's row.
	gridAutoFlow: "dense",
	columnGap: "4",
	rowGap: "3",
	alignItems: "start",
	paddingBlock: "5",
	borderBottom: "hairline",
	color: "academy.text",
	textDecoration: "none",
	_sm: {
		columnGap: "6",
		"&[data-media='true']": { gridTemplateColumns: "minmax(0, 1fr) 9rem" },
	},
	// On wide screens the still sits in its own trailing column so every
	// title in the ledger starts on the same line, still or not.
	_lg: {
		gridTemplateColumns: "6.5rem minmax(0, 1fr) 12rem",
		// Restated so the `sm` rule above, which is more specific, yields.
		"&[data-media='true']": {
			gridTemplateColumns: "6.5rem minmax(0, 1fr) 12rem",
		},
		columnGap: "8",
		paddingBlock: "6",
	},
	...scrollReveal,
	_hover: {
		"& :is(h2, h3)": { color: "academy.accent" },
		"& img": { transform: "scale(1.03)" },
		"& [data-body]": { transform: "translateX(0.35rem)" },
	},
	_focusVisible: focusRing,
	_motionReduce: { animation: "none" },
} as const satisfies SystemStyleObject;

/** The day is the numeral; month and year sit beneath it in mono. */
export const ledgerDate = {
	gridColumn: "1 / -1",
	display: "flex",
	alignItems: "baseline",
	gap: "2",
	color: "academy.textMuted",
	fontFamily: "academy-mono",
	fontSize: "xs",
	lineHeight: "body",
	"& strong": {
		color: "academy.text",
		fontFamily: "academy-display",
		fontSize: "xl",
		fontWeight: "extrabold",
		letterSpacing: "academy-tight",
		lineHeight: "none",
		fontVariantNumeric: "tabular-nums",
	},
	_lg: {
		gridColumn: "1",
		display: "grid",
		gap: "1",
		paddingBlockStart: "0.5",
		"& strong": { fontSize: "academy-ledger-day" },
	},
} as const satisfies SystemStyleObject;

export const ledgerMedia = {
	...videoFrame,
	display: "none",
	borderRadius: "academy-s",
	_sm: { display: "block", gridColumn: "2" },
	_lg: { display: "block", gridColumn: "3", gridRow: "1" },
} as const satisfies SystemStyleObject;

export const ledgerImage = coverImageZoom;

export const ledgerBody = {
	display: "grid",
	gap: "2",
	gridColumn: "1",
	minWidth: "0",
	transitionProperty: "[transform]",
	transitionDuration: "slow",
	transitionTimingFunction: "academy-out",
	_lg: { gridColumn: "2", gridRow: "1" },
	_motionReduce: { transitionDuration: "none" },
} as const satisfies SystemStyleObject;

export const ledgerTitle = {
	margin: "0",
	fontFamily: "academy-display",
	fontSize: "lg",
	fontWeight: "bold",
	lineHeight: "tight",
	letterSpacing: "academy-tight",
	textWrap: "pretty",
	transitionProperty: "colors",
	transitionDuration: "base",
	_lg: { fontSize: "2xl" },
} as const satisfies SystemStyleObject;

export const ledgerDescription = {
	margin: "0",
	maxWidth: "academy-copy",
	color: "academy.textSoft",
	fontSize: "sm",
	lineHeight: "academy-reading",
	textWrap: "pretty",
} as const satisfies SystemStyleObject;
