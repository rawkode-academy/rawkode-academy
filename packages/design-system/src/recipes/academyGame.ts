import { sva } from "../../styled-system/css";

/** Shared game typography, focus, and motion policy; game boards own geometry. */
export const academyGame = sva({
	slots: ["root"],
	base: {
		root: {
			minWidth: "0", maxWidth: "full", color: "academy.text", fontFamily: "academy-text",
			"& button, & input, & select": { fontFamily: "inherit", minHeight: "11" },
			"& button:focus-visible, & a:focus-visible, & input:focus-visible": { outline: "focus", outlineColor: "academy.accent", outlineOffset: "focus" },
			"& button:disabled": { cursor: "not-allowed" },
			_motionReduce: { "&, & *, & *::before, & *::after": { animation: "none!", transitionDuration: "none!", scrollBehavior: "auto" } },
		},
	},
});
