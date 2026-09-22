import { sva } from "../../styled-system/css";

/** Maintainer session details; EditorialShell owns the surrounding sections. */
export const academyMaintainers = sva({
	slots: ["steps", "step", "stepTitle", "stepBody", "copy", "link"],
	base: {
		steps: {
			counterReset: "step",
			display: "grid",
			margin: "0",
			padding: "0",
			listStyle: "none",
		},
		step: {
			counterIncrement: "step",
			display: "grid",
			gridTemplateColumns: "2rem minmax(0, 1fr)",
			columnGap: "4",
			paddingBlock: "5",
			borderBottom: "hairline",
			borderColor: "academy.border",
			_first: { paddingTop: "0" },
			_last: { border: "none", paddingBottom: "0" },
			_before: {
				content: "counter(step, decimal-leading-zero)",
				gridRow: "span 2",
				paddingTop: "1",
				color: "academy.accent",
				fontFamily: "academy-mono",
				fontSize: "sm",
			},
		},
		stepTitle: {
			fontFamily: "academy-display",
			fontSize: "xl",
			fontWeight: "bold",
			lineHeight: "academy-card",
		},
		stepBody: {
			marginTop: "2",
			color: "academy.textSoft",
			lineHeight: "academy-reading",
		},
		copy: { display: "grid", alignContent: "start", gap: "6" },
		link: {
			width: "fit-content",
			minHeight: "11",
			display: "inline-flex",
			alignItems: "center",
			color: "academy.accent",
			textUnderlineOffset: "0.2em",
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "1",
			},
		},
	},
});
