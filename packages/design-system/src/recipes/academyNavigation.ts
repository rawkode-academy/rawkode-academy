import { sva } from "../../styled-system/css";
import { focusRing } from "../styles/focus";
import { monoMeta } from "../styles/type";

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
		// One trail for every detail page: sentence-case mono in the muted
		// text colour, parent links only, inside the page header. Items sit
		// on one baseline; the padding gives each link its hit area.
		breadcrumb: { ...monoMeta, minWidth: "0" },
		trail: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "baseline",
			columnGap: "2",
			margin: "0",
			padding: "0",
			listStyle: "none",
			"& li": { display: "inline-flex", alignItems: "baseline", gap: "2" },
		},
		crumb: {
			display: "inline-block",
			paddingBlock: "3",
			color: "academy.textMuted",
			textDecoration: "none",
			_hover: {
				color: "academy.accent",
				textDecoration: "underline",
				textUnderlineOffset: "0.2em",
			},
			_focusVisible: focusRing,
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
			_focusVisible: focusRing,
		},
	},
});
