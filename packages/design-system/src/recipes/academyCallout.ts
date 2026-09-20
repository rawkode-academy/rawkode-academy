import { sva } from "../../styled-system/css";

/** Authored callouts share Academy surfaces and theme-aware status colors. */
export const academyCallout = sva({
	slots: ["root", "header", "icon", "label", "body"],
	base: {
		root: {
			marginBlock: "7",
			padding: "4",
			minWidth: "0",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-m",
			backgroundColor: "academy.ground",
			color: "academy.textSoft",
			fontFamily: "academy-text",
			overflowWrap: "anywhere",
		},
		header: {
			display: "flex",
			alignItems: "center",
			gap: "2",
			marginBottom: "2",
		},
		icon: { display: "block", width: "4", height: "4", flexShrink: "0" },
		label: {
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontWeight: "semibold",
			letterSpacing: "wide",
			textTransform: "uppercase",
		},
		body: {
			minWidth: "0",
			fontSize: "sm",
			lineHeight: "relaxed",
			// Override surrounding article typography only inside this callout.
			"&& p": {
				margin: "0",
				fontSize: "sm",
				lineHeight: "relaxed",
				color: "academy.textSoft",
			},
			"&& > * + *": { marginTop: "2" },
			"&& p + p": { marginTop: "2" },
			"&& a": {
				color: "academy.accent",
				textDecoration: "underline",
				textUnderlineOffset: "{spacing.0.5}",
				_hover: { color: "academy.text" },
				_focusVisible: {
					outline: "focus",
					outlineColor: "academy.accent",
					outlineOffset: "focus",
				},
			},
		},
	},
	variants: {
		tone: {
			info: { header: { color: "academy.statusSky" } },
			tip: { header: { color: "academy.statusSpruce" } },
			caution: { header: { color: "academy.statusAmber" } },
			danger: { header: { color: "academy.statusRust" } },
		},
	},
	defaultVariants: { tone: "info" },
});
