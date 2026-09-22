import { sva } from "../../styled-system/css";

/** Static diagrams remain legible without a modal, client island or duplicate SVG. */
export const academyDiagram = sva({
	slots: ["root", "caption", "toggle", "viewport", "image", "description"],
	base: {
		root: {
			marginBlock: "8",
			minWidth: "0",
			"&:has(input:checked) [data-diagram-image]": { minWidth: "7xl" },
			"&:has(input:checked) [data-diagram-viewport]": {
				maxHeight: "academy-diagram-viewport",
				overflow: "auto",
				overscrollBehavior: "contain",
			},
			"&:has(input:checked) [data-diagram-image] > svg": {
				maxHeight: "initial",
				width: "full",
			},
		},
		caption: { fontWeight: "bold", fontSize: "md", color: "academy.text" },
		toggle: {
			display: "flex",
			alignItems: "center",
			gap: "3",
			minHeight: "11",
			width: "fit-content",
			marginBlock: "2",
			fontSize: "sm",
			cursor: "pointer",
			color: "academy.textSoft",
			"& input": { width: "5", height: "5", accentColor: "academy.accent" },
			"&:has(input:focus-visible)": {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "1",
			},
		},
		viewport: {
			overflow: "visible",
			maxWidth: "full",
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "1",
			},
		},
		image: {
			display: "grid",
			placeItems: "center",
			"& > svg": {
				width: "auto",
				height: "auto",
				maxHeight: "academy-diagram-viewport",
			},
		},
		description: {
			marginTop: "3",
			fontSize: "sm",
			lineHeight: "academy-reading",
			color: "academy.textSoft",
		},
	},
});
