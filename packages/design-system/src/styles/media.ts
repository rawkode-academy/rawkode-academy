import type { SystemStyleObject } from "../../styled-system/types";

/**
 * Media fragments: the 16:9 still that identifies a session, the image that
 * fills it, and the runtime badge set over it.
 *
 *   media: { ...videoFrame, borderRadius: "academy-m" },
 *   image: coverImageZoom,
 *   runtime: runtimeBadge,
 *
 * The frame leaves its radius to the slot: a card rounds it, a ruled row
 * does not.
 */

/** An image that fills its frame, cropped rather than squashed. */
export const coverImage = {
	display: "block",
	width: "full",
	height: "full",
	objectFit: "cover",
} as const satisfies SystemStyleObject;

/**
 * A cover image that eases when its link is hovered. The linked ancestor
 * sets the scale: `_hover: { "& img": { transform: "scale(1.03)" } }`.
 */
export const coverImageZoom = {
	...coverImage,
	transitionProperty: "[transform]",
	transitionDuration: "reveal",
	transitionTimingFunction: "academy-out",
	_motionReduce: { transitionDuration: "none" },
} as const satisfies SystemStyleObject;

/** The 16:9 frame for a video still or article cover. */
export const videoFrame = {
	position: "relative",
	display: "block",
	overflow: "hidden",
	aspectRatio: "academy-video",
	backgroundColor: "academy.ground",
} as const satisfies SystemStyleObject;

/**
 * A runtime set over the trailing corner of a still. It is always ink, in
 * both colour schemes, so it reads over any photograph.
 */
export const runtimeBadge = {
	position: "absolute",
	insetBlockEnd: "2",
	insetInlineEnd: "2",
	paddingInline: "2",
	paddingBlock: "0.5",
	borderRadius: "academy-s",
	backgroundColor: "academy.ink",
	color: "academy.inkText",
	fontFamily: "academy-mono",
	fontSize: "xs",
	lineHeight: "body",
	fontVariantNumeric: "tabular-nums",
} as const satisfies SystemStyleObject;

/**
 * A partner's logo printed in the current text colour, so marks drawn in
 * different palettes read as one set on any surface and in both schemes.
 * The element carries the file as `--partner-mark` and is sized by the
 * transparent `<img>` inside it, which also holds the alt text:
 *
 *   <span data-part="mark" style="--partner-mark:url(...)"><img alt="Datum" /></span>
 */
export const partnerMark = {
	display: "inline-block",
	flexShrink: "0",
	backgroundColor: "currentColor",
	maskImage: "[var(--partner-mark)]",
	maskRepeat: "no-repeat",
	maskPosition: "center",
	maskSize: "contain",
	"& img": {
		display: "block",
		height: "[var(--partner-mark-h, 16px)]",
		width: "auto",
		maxWidth: "32",
		opacity: "0",
	},
} as const satisfies SystemStyleObject;
