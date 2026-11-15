import type { SystemStyleObject } from "../../styled-system/types";
import { focusRing } from "./focus";

/**
 * The standalone text link: "All videos →", a project's documentation, a
 * community channel. Text colour and semibold at rest, the accent and an
 * underline on hover; a trailing `<span>` (an arrow) travels with it.
 *
 *   more: textLink,
 *
 * Links inside a sentence stay underlined in the accent; this is for a link
 * that stands on its own line.
 */
export const textLink = {
	display: "inline-flex",
	alignItems: "center",
	gap: "2",
	width: "fit-content",
	minHeight: "11",
	color: "academy.text",
	fontSize: "sm",
	fontWeight: "semibold",
	textDecoration: "none",
	"& > span": {
		transitionProperty: "[transform]",
		transitionDuration: "base",
		transitionTimingFunction: "academy-out",
	},
	_hover: {
		color: "academy.accent",
		textDecoration: "underline",
		textUnderlineOffset: "0.2em",
		"& > span": { transform: "translateX(0.2em)" },
	},
	_focusVisible: focusRing,
	_motionReduce: { "& > span": { transitionDuration: "none" } },
} as const satisfies SystemStyleObject;
