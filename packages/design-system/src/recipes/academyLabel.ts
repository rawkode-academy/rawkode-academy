import { sva } from "../../styled-system/css";

/** Compact metadata and status labels shared by Academy documents. */
export const academyLabel = sva({
	slots: ["root", "liveDot"],
	base: {
		root: {
			display: "inline-flex",
			alignItems: "center",
			gap: "2",
			margin: "0",
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontWeight: "semibold",
			letterSpacing: "wider",
			lineHeight: "none",
			textTransform: "uppercase",
		},
		liveDot: {
			display: "inline-block",
			flexShrink: "0",
			borderRadius: "full",
			backgroundColor: "academy.accent",
			animation: "academy-live",
			_motionReduce: { animation: "none" },
		},
	},
	variants: {
		tone: {
			muted: { root: { color: "academy.textMuted" }, liveDot: { backgroundColor: "academy.textMuted" } },
			soft: { root: { color: "academy.textSoft" }, liveDot: { backgroundColor: "academy.textSoft" } },
			ink: { root: { color: "academy.text" }, liveDot: { backgroundColor: "academy.text" } },
			accent: { root: { color: "academy.accent" }, liveDot: { backgroundColor: "academy.accent" } },
			amber: { root: { color: "academy.statusAmber" }, liveDot: { backgroundColor: "academy.statusAmber" } },
			rust: { root: { color: "academy.statusRust" }, liveDot: { backgroundColor: "academy.statusRust" } },
			spruce: { root: { color: "academy.statusSpruce" }, liveDot: { backgroundColor: "academy.statusSpruce" } },
		},
	},
	defaultVariants: {
		tone: "muted",
	},
});
