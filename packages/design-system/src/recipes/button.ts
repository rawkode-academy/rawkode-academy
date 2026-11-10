import { cva } from "../../styled-system/css";
import { focusRing, focusRingInk } from "../styles/focus";

/**
 * The Academy button. One recipe for every action on the site, whether it
 * renders as `<button>` or `<a>`.
 *
 *   button()                               // the page's primary action
 *   button({ variant: "outline" })         // a secondary action beside it
 *   button({ surface: "ink" })             // the same actions on an ink surface
 *   button({ variant: "quiet", size: "sm" }) // toolbar and in-panel controls
 *
 * A page has at most one `solid` button per view: it is the accent, and the
 * accent is the thing to do next. Everything else is `outline` or `quiet`.
 *
 * Mark a trailing arrow with `data-part="arrow"` (the Vue `Button` does this
 * for you) and it travels on hover. A toggle sets `aria-pressed`; a pending
 * action sets `aria-busy`. Neither needs its own style.
 */
export const button = cva({
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "2",
		flexShrink: "0",
		border: "academy-button",
		borderRadius: "academy-s",
		fontFamily: "academy-text",
		fontSize: "sm",
		fontWeight: "semibold",
		lineHeight: "academy-card",
		textAlign: "center",
		textDecoration: "none",
		cursor: "pointer",
		userSelect: "none",
		transitionProperty: "[background-color, border-color, color, transform]",
		transitionDuration: "fast",
		transitionTimingFunction: "academy-out",
		"& svg": { width: "4", height: "4", flexShrink: "0" },
		"& [data-part=arrow]": {
			display: "inline-block",
			transitionProperty: "[transform]",
			transitionDuration: "base",
			transitionTimingFunction: "academy-out",
		},
		_hover: { "& [data-part=arrow]": { transform: "translateX(0.2em)" } },
		_active: { transform: "translateY(1px)" },
		_focusVisible: focusRing,
		_disabled: {
			opacity: "0.5",
			cursor: "not-allowed",
			transform: "none",
			"& [data-part=arrow]": { transform: "none" },
		},
		"&[aria-busy=true]": { cursor: "progress" },
		_motionReduce: {
			transitionDuration: "none",
			transform: "none",
			"& [data-part=arrow]": {
				transitionDuration: "none",
				transform: "none",
			},
		},
	},
	variants: {
		variant: {
			solid: {
				backgroundColor: "academy.accent",
				color: "academy.accentForeground",
				fontWeight: "bold",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					backgroundColor: "academy.accentHover",
				},
			},
			outline: {
				borderColor: "academy.inputBorder",
				backgroundColor: "transparent",
				color: "academy.text",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					borderColor: "academy.accent",
					color: "academy.accent",
				},
				"&[aria-pressed=true]": {
					borderColor: "academy.accent",
					backgroundColor: "academy.accent",
					color: "academy.accentForeground",
				},
			},
			quiet: {
				backgroundColor: "transparent",
				color: "academy.textSoft",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					backgroundColor: "academy.ground",
					color: "academy.text",
				},
				"&[aria-pressed=true]": {
					backgroundColor: "academy.ground",
					color: "academy.accent",
				},
			},
		},
		/**
		 * The surface the button sits on. Ink surfaces (hero, masthead, video
		 * stage, footer) carry their own accent and border tokens, so a button
		 * placed on one must say so.
		 */
		surface: { canvas: {}, ink: { _focusVisible: focusRingInk } },
		size: {
			sm: { minHeight: "9", paddingInline: "4", paddingBlock: "2" },
			md: { minHeight: "11", paddingInline: "5", paddingBlock: "2" },
			lg: {
				gap: "3",
				minHeight: "12",
				paddingInline: "6",
				paddingBlock: "3",
			},
		},
		/** Stretch to the container: a form's submit, a stacked mobile action. */
		fullWidth: { true: { width: "full" } },
		/** A square control that holds one icon. It still needs an accessible name. */
		icon: { true: { paddingInline: "0", paddingBlock: "0" } },
	},
	compoundVariants: [
		{
			variant: "solid",
			surface: "ink",
			css: {
				backgroundColor: "academy.inkAccent",
				color: "academy.inkAccentForeground",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					backgroundColor: "academy.inkAccentHover",
				},
			},
		},
		{
			variant: "outline",
			surface: "ink",
			css: {
				borderColor: "academy.inkBorder",
				color: "academy.inkText",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					borderColor: "academy.inkText",
					backgroundColor: "academy.inkRaised",
					color: "academy.inkText",
				},
				"&[aria-pressed=true]": {
					borderColor: "academy.inkAccent",
					backgroundColor: "academy.inkAccent",
					color: "academy.inkAccentForeground",
				},
			},
		},
		{
			variant: "quiet",
			surface: "ink",
			css: {
				color: "academy.inkTextSoft",
				"&:is(:hover, [data-hover]):not(:disabled)": {
					backgroundColor: "academy.inkRaised",
					color: "academy.inkText",
				},
				"&[aria-pressed=true]": {
					backgroundColor: "academy.inkRaised",
					color: "academy.inkAccent",
				},
			},
		},
		{ icon: true, size: "sm", css: { width: "9" } },
		{ icon: true, size: "md", css: { width: "11" } },
		{ icon: true, size: "lg", css: { width: "12" } },
	],
	defaultVariants: { variant: "solid", surface: "canvas", size: "md" },
});

export type ButtonVariants = NonNullable<Parameters<typeof button>[0]>;
