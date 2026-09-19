import { sva } from "../../styled-system/css";

export const tabs = sva({
	slots: ["root", "list", "trigger", "indicator", "content"],
	base: {
		root: {
			width: "full",
		},
		list: {
			display: "grid",
			gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
			gap: "2",
			borderBottom: "hairline",
			borderColor: "academy.border",
		},
		trigger: {
			position: "relative",
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
