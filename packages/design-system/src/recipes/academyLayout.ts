import { sva } from "../../styled-system/css";
import { inputField } from "../styles/field";
import { inkStage } from "../styles/ink";
import { coverImage } from "../styles/media";
import { proseLists } from "../styles/prose";
import { linkedPanel, panelSurface, pill } from "../styles/surface";
import { headingLg, headingMd, ledeText, mastheadTitle } from "../styles/type";

/** Content primitives. The document wrapper owns header/main/footer landmarks. */
export const academyLayout = sva({
	slots: [
		"root",
		"hero",
		"heroInner",
		"heroCopy",
		"heroAside",
		"masthead",
		"mastheadInner",
		"mastheadCopy",
		"mastheadAside",
		"mastheadKicker",
		"mastheadTitle",
		"mastheadHeading",
		"mastheadDescription",
		"mastheadCount",
		"mastheadSummary",
		"mastheadMosaic",
		"mastheadTile",
		"mastheadImage",
		"container",
		"kicker",
		"title",
		"description",
		"section",
		"sectionHeader",
		"sectionTitle",
		"grid",
		"card",
		"cardMedia",
		"cardBody",
		"cardTitle",
		"meta",
		"prose",
		"sidebar",
		"split",
		"toolbar",
		"input",
		"tag",
		"empty",
		"notice",
		"breadcrumbs",
		"list",
		"table",
		"tableWrap",
	],
	base: {
		root: {
			color: "academy.text",
			backgroundColor: "academy.canvas",
			fontFamily: "academy-text",
			lineHeight: "body",
			paddingBottom: "16",
			minWidth: "0",
		},
		hero: {
			paddingBlock: "8",
			paddingInline: "academy-gutter",
			backgroundColor: "academy.canvas",
			borderBottom: "hairline",
			borderColor: "academy.border",
			_lg: { paddingBlock: "10" },
		},
		heroInner: {
			display: "grid",
			gap: "5",
			alignItems: "end",
			_lg: {
				gridTemplateColumns: "minmax(0, 1.15fr) minmax(18rem, .85fr)",
				gap: "12",
			},
		},
		heroCopy: { display: "grid", gap: "4", minWidth: "0" },
		// Collection mastheads open in ink with the title at poster scale and
		// the collection's real size set beside it. The system grid is the
		// masthead's ground: on wide screens the collection's own artwork is
		// scheduled into its cells (see mastheadMosaic), so the motif carries
		// the work instead of decorating an empty panel. Reading pages keep the
		// canvas hero above.
		masthead: {
			...inkStage,
			paddingBlockStart: "academy-hero-tight",
			paddingBlockEnd: "10",
			paddingInline: "academy-gutter",
			_lg: {
				minHeight: "academy-masthead",
				paddingBlockStart: "academy-masthead-top",
				paddingBlockEnd: "12",
			},
		},
		mastheadInner: {
			display: "grid",
			gap: "5",
			alignContent: "start",
			_lg: { gap: "6", maxWidth: "academy-masthead-copy" },
		},
		mastheadCopy: { display: "grid", gap: "5", minWidth: "0" },
		mastheadAside: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "4",
			"&:empty": { display: "none" },
		},
		mastheadKicker: {
			margin: "0",
			color: "academy.inkAccent",
			fontFamily: "academy-mono",
			fontSize: "sm",
		},
		mastheadTitle: {
			...mastheadTitle,
			animation: "academy-rise",
			_motionReduce: { animation: "none" },
		},
		// The heading sits inline in the title row so the count can follow
		// its last word; it takes the row's type.
		mastheadHeading: {
			display: "inline",
			margin: "0",
			font: "inherit",
			letterSpacing: "inherit",
			color: "inherit",
		},
		// The collection's real size, set as a superscript numeral beside the
		// title. It is aria-hidden; mastheadSummary carries it for assistive
		// technology so the heading stays the collection's name.
		mastheadCount: {
			position: "relative",
			top: "[0.35em]",
			display: "inline-block",
			marginInlineStart: "[0.12em]",
			color: "academy.inkAccent",
			fontFamily: "academy-mono",
			// Never smaller than the smallest metadata, so it stays legible
			// when the title steps down on a phone.
			fontSize: "[max(0.2em, 0.8125rem)]",
			fontWeight: "medium",
			letterSpacing: "[0]",
			lineHeight: "none",
			verticalAlign: "top",
			fontVariantNumeric: "tabular-nums",
		},
		mastheadSummary: { srOnly: true },
		mastheadDescription: {
			...ledeText,
			color: "academy.inkTextSoft",
			animation: "academy-rise",
			animationDelay: "stagger-2",
			_motionReduce: { animation: "none" },
		},
		// The mosaic sits on the same 4rem lattice as the grid behind it. Its
		// origin is one cell right of the centre line, and each tile is placed
		// by whole cells (--x, --y, --w, --h) and inset by the hairline so the
		// grid still reads between the pictures. Tiles fade in from the left
		// so a long title always reads over them.
		mastheadMosaic: {
			display: "none",
			_lg: {
				display: "block",
				position: "absolute",
				insetBlock: "0",
				insetInlineEnd: "0",
				// One cell further out until the shell is wide enough for a
				// masthead title and the wall to sit side by side.
				insetInlineStart: "[calc(50% + 6rem)]",
				"@media (min-width: 1280px)": {
					insetInlineStart: "[calc(50% + 2rem)]",
				},
				pointerEvents: "none",
				maskImage:
					"[linear-gradient(90deg, transparent 0, black 14rem), linear-gradient(180deg, black 72%, transparent 100%)]",
				maskComposite: "intersect",
			},
		},
		mastheadTile: {
			position: "absolute",
			left: "[calc(var(--x) * 4rem + 1px)]",
			top: "[calc(var(--y) * 4rem + 1px)]",
			width: "[calc(var(--w) * 4rem - 1px)]",
			height: "[calc(var(--h) * 4rem - 1px)]",
			overflow: "hidden",
			backgroundColor: "academy.inkRaised",
			animation: "academy-schedule",
			animationDelay: "[calc(160ms + var(--i) * 70ms)]",
			_motionReduce: { animation: "none" },
			"&[data-shape='logo']": {
				display: "grid",
				placeItems: "center",
				padding: "3",
				backgroundColor: "academy.inkText",
			},
		},
		mastheadImage: {
			...coverImage,
			// Everything but the lead tile is printed in the ink itself, a
			// navy duotone, so the wall reads as one surface and the lead as
			// the thing on air.
			filter: "[grayscale(1) contrast(1.1)]",
			mixBlendMode: "luminosity",
			opacity: "0.72",
			"[data-lit] > &": {
				filter: "[none]",
				mixBlendMode: "normal",
				opacity: "1",
			},
			"[data-shape='logo'] > &": {
				objectFit: "contain",
				filter: "[grayscale(1)]",
				mixBlendMode: "normal",
				opacity: "0.7",
			},
			"[data-shape='logo'][data-lit] > &": { filter: "[none]", opacity: "1" },
		},
		heroAside: {
			display: "grid",
			gap: "4",
			alignContent: "end",
			minWidth: "0",
			_lg: { paddingBlockEnd: "1" },
		},
		container: {
			maxWidth: "academy-content",
			marginInline: "auto",
			width: "full",
			minWidth: "0",
		},
		kicker: {
			margin: "0",
			color: "academy.accent",
			fontFamily: "academy-mono",
			fontSize: "xs",
			letterSpacing: "wide",
		},
		title: {
			maxWidth: "academy-copy",
			margin: "0",
			fontFamily: "academy-display",
			fontSize: "academy-title",
			fontWeight: "bold",
			lineHeight: "academy-title",
			letterSpacing: "academy-display",
			overflowWrap: "anywhere",
		},
		description: {
			maxWidth: "academy-copy",
			margin: "0",
			color: "academy.textSoft",
			fontSize: "lg",
			lineHeight: "relaxed",
			textWrap: "pretty",
		},
		section: {
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			paddingTop: "10",
			minWidth: "0",
		},
		sectionHeader: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "4",
			marginBottom: "6",
		},
		sectionTitle: headingLg,
		grid: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
			gap: "6",
		},
		card: {
			...linkedPanel,
			display: "flex",
			flexDirection: "column",
			minWidth: "0",
			overflow: "hidden",
		},
		cardMedia: {
			width: "full",
			aspectRatio: "academy-video",
			objectFit: "cover",
			backgroundColor: "academy.ground",
		},
		cardBody: {
			padding: "6",
			display: "flex",
			flexDirection: "column",
			gap: "3",
		},
		cardTitle: headingMd,
		meta: {
			display: "flex",
			flexWrap: "wrap",
			gap: "3",
			color: "academy.textMuted",
			fontSize: "sm",
			margin: "0",
		},
		prose: {
			color: "academy.textSoft",
			fontSize: "lg",
			lineHeight: "relaxed",
			overflowWrap: "anywhere",
			"& > * + *": { marginTop: "6" },
			"& h2, & h3, & h4": {
				color: "academy.text",
				fontFamily: "academy-display",
				fontWeight: "bold",
				lineHeight: "tight",
			},
			"& h2": { fontSize: "3xl" },
			"& h3": { fontSize: "2xl" },
			"& a": {
				color: "academy.accent",
				textDecoration: "underline",
				textUnderlineOffset: "0.2em",
			},
			...proseLists,
			"& img": { maxWidth: "full", height: "auto" },
			"& pre": {
				maxWidth: "full",
				overflowX: "auto",
				padding: "6",
				borderRadius: "academy-m",
				backgroundColor: "academy.ground",
			},
			// Rich text emits a bare table with no wrapper, so the table is its
			// own scroll container: a wide one scrolls inside the column rather
			// than breaking identifiers mid-word.
			"& table": {
				display: "block",
				width: "max-content",
				maxWidth: "full",
				overflowX: "auto",
				borderCollapse: "collapse",
				fontSize: "sm",
				lineHeight: "normal",
				overflowWrap: "normal",
			},
			"& th, & td": {
				padding: "3",
				textAlign: "start",
				verticalAlign: "top",
				borderBottom: "hairline",
				borderBottomColor: "academy.border",
			},
			"& th": {
				color: "academy.text",
				fontWeight: "semibold",
				backgroundColor: "academy.ground",
			},
			"& td code": { whiteSpace: "nowrap" },
		},
		sidebar: {
			...panelSurface,
			minWidth: "0",
			alignSelf: "start",
			padding: "6",
		},
		split: {
			display: "grid",
			gap: "8",
			minWidth: "0",
			_lg: { gridTemplateColumns: "minmax(0, 2fr) minmax(16rem, 1fr)" },
		},
		toolbar: {
			display: "grid",
			gridTemplateColumns: "1fr",
			alignItems: "end",
			columnGap: "4",
			rowGap: "2",
			marginBottom: "8",
			paddingBlock: "3",
			borderBottom: "hairline",
			borderColor: "academy.border",
			"& > label": {
				color: "academy.textMuted",
				fontFamily: "academy-mono",
				fontSize: "xs",
				fontWeight: "semibold",
				letterSpacing: "wide",
			},
			"& > p": {
				justifySelf: "start",
				margin: "0",
				color: "academy.textMuted",
				fontFamily: "academy-mono",
				fontSize: "xs",
				letterSpacing: "wide",
			},
			_sm: { gridTemplateColumns: "1fr minmax(16rem, 24rem)" },
			_lg: {
				gridTemplateColumns: "auto minmax(16rem, 24rem) 1fr",
				"& > p": { justifySelf: "end" },
			},
		},
		input: {
			...inputField,
			minHeight: "12",
			paddingInline: "4",
			paddingBlock: "2",
			font: "inherit",
		},
		tag: {
			...pill,
			color: "academy.textSoft",
			backgroundColor: "academy.panel",
			textDecoration: "none",
		},
		empty: {
			padding: "10",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-m",
			textAlign: "center",
			color: "academy.textSoft",
		},
		notice: {
			padding: "5",
			border: "hairline",
			borderColor: "academy.border",
			borderTop: "focus",
			borderTopColor: "academy.accent",
			borderRadius: "academy-s",
			backgroundColor: "academy.panel",
			color: "academy.textSoft",
			lineHeight: "relaxed",
			"& a": { color: "academy.accent", textUnderlineOffset: "0.2em" },
		},
		breadcrumbs: {
			display: "flex",
			flexWrap: "wrap",
			gap: "2",
			color: "academy.textMuted",
			fontSize: "sm",
			marginBottom: "6",
		},
		list: {
			display: "grid",
			gap: "4",
			margin: "0",
			padding: "0",
			listStyle: "none",
		},
		tableWrap: {
			width: "full",
			overflowX: "auto",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-m",
		},
		table: {
			width: "full",
			borderCollapse: "collapse",
			fontSize: "sm",
			"& th, & td": {
				padding: "4",
				textAlign: "start",
				borderBottom: "hairline",
				borderColor: "academy.border",
			},
			"& th": {
				backgroundColor: "academy.ground",
				color: "academy.text",
				fontWeight: "semibold",
			},
			"& td": { color: "academy.textSoft" },
		},
	},
	variants: {
		width: {
			wide: {},
			reading: {
				container: { maxWidth: "academy-copy" },
				section: { maxWidth: "academy-copy" },
			},
		},
	},
	defaultVariants: { width: "wide" },
});
