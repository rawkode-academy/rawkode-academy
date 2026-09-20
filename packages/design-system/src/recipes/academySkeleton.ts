import { sva } from "../../styled-system/css";

/** Shared loading placeholders without coupling common components to a route recipe. */
export const academySkeleton = sva({
	slots: [
		"row",
		"content",
		"meta",
		"avatar",
		"line",
		"lineSmall",
		"lineMedium",
		"stack",
		"text",
	],
	base: {
		row: {
			display: "flex",
			gap: "3",
			padding: "4",
			borderBottom: "hairline",
			borderColor: "academy.border",
		},
		content: { minWidth: "0", flex: "1" },
		meta: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "2",
			marginBlockEnd: "2",
		},
		avatar: {
			flexShrink: "0",
			borderRadius: "full",
			backgroundColor: "academy.ground",
			animation: "academy-skeleton",
			_motionReduce: { animation: "none" },
		},
		line: {
			borderRadius: "academy-s",
			backgroundColor: "academy.ground",
			animation: "academy-skeleton",
			_motionReduce: { animation: "none" },
		},
		lineSmall: {
			height: "3",
			borderRadius: "academy-s",
			backgroundColor: "academy.ground",
			animation: "academy-skeleton",
			_motionReduce: { animation: "none" },
		},
		lineMedium: {
			height: "4",
			borderRadius: "academy-s",
			backgroundColor: "academy.ground",
			animation: "academy-skeleton",
			_motionReduce: { animation: "none" },
		},
		stack: { display: "flex", flexDirection: "column", gap: "4" },
		text: { display: "flex", flexDirection: "column", gap: "2", width: "full" },
	},
});
