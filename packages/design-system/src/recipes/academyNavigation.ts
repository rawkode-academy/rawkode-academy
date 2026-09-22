import { sva } from "../../styled-system/css";

/** Secondary orientation without competing with the page's primary action. */
export const academyNavigation = sva({
	slots: [
		"breadcrumb",
		"trail",
		"crumb",
		"separator",
		"sections",
		"sectionList",
		"sectionLink",
	],
	base: {
		breadcrumb: { color: "academy.textMuted", fontSize: "sm" },
		trail: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "3",
			margin: "0",
			padding: "0",
			listStyle: "none",
			"& li": { display: "inline-flex", alignItems: "center", gap: "3" },
		},
		crumb: {
			display: "inline-flex",
			alignItems: "center",
			minHeight: "11",
			color: "academy.textMuted",
			textDecoration: "none",
			_hover: { color: "academy.accent", textDecoration: "underline" },
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "focus",
			},
		},
		separator: { color: "academy.textMuted" },
		sections: { borderBlockEnd: "hairline", backgroundColor: "academy.canvas" },
		sectionList: {
			display: "flex",
			flexWrap: "wrap",
			gap: "5",
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			listStyle: "none",
			"& li": { minWidth: "0" },
		},
		sectionLink: {
			display: "inline-flex",
			alignItems: "center",
			minHeight: "12",
			paddingBlock: "3",
			borderBottom: "academy-button",
			color: "academy.textSoft",
			fontSize: "sm",
			textDecoration: "none",
			"&[aria-current=page]": {
				color: "academy.accent",
				borderColor: "academy.accent",
				fontWeight: "bold",
			},
			_hover: { color: "academy.accent" },
			_focusVisible: {
				outline: "focus",
				outlineColor: "academy.accent",
				outlineOffset: "focus",
			},
		},
	},
});
