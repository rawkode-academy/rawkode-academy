import { sva } from "../../styled-system/css";

export const tabs = sva({
	slots: ["root", "list", "trigger", "indicator", "content"],
	base: {
		root: {
			width: "full",
		},
		list: {
			display: "flex",
			alignItems: "stretch",
			gap: "2",
			overflowX: "auto",
			borderBottom: "hairline",
			borderColor: "academy.border",
		},
		trigger: {
			position: "relative",
			flexGrow: 1,
			flexShrink: 0,
			minWidth: "32",
			minHeight: "11",
			paddingInline: "3",
			border: "academy-button",
			borderTop: "academy-tab",
			borderTopColor: "academy.border",
			background: "transparent",
			color: "academy.textMuted",
			fontFamily: "academy-text",
			fontSize: "sm",
			fontWeight: "semibold",
			textAlign: "left",
			cursor: "pointer",
			transitionProperty: "colors",
			transitionDuration: "fast",
			_hover: {
				color: "academy.text",
			},
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "focus",
			},
			_selected: {
				borderTopColor: "academy.accent",
				background: "academy.panel",
				color: "academy.text",
			},
			_motionReduce: {
				transitionDuration: "none",
			},
		},
		indicator: {
			display: "none",
		},
		content: {
			display: "flex",
			flexDirection: "column",
			gap: "2",
			paddingBlock: "6",
			color: "academy.textSoft",
			fontSize: "md",
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "focus",
			},
		},
	},
	variants: {
		tone: {
			academy: {},
		},
	},
	defaultVariants: {
		tone: "academy",
	},
});
