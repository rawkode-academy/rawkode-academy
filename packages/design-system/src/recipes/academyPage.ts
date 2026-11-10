import { sva } from "../../styled-system/css";
import { focusRing, focusRingInk, focusRingInset } from "../styles/focus";
import { scrollReveal } from "../styles/motion";
import { ruledList } from "../styles/ledger";
import {
	cardTitle,
	headingLg,
	ledeText,
	monoMeta,
	posterTitle,
	sectionTitle,
} from "../styles/type";
import { inputField } from "../styles/field";
import { textLink } from "../styles/link";
import { inkStage, inkSurface } from "../styles/ink";
import { coverImageZoom, runtimeBadge, videoFrame } from "../styles/media";

/**
 * The Academy front door, video library, and learning-path directory.
 *
 * The homepage opens on a short ink hero (navy in light mode, a raised
 * panel in dark mode) that holds only the statement, its lede and the living
 * system. The canvas follows with the next live stream and the latest
 * session as a pair, then the field index of the four collections on its own
 * ink band, the three-column ledger and the learning paths. Motion is a
 * single entrance sequence (statement, lede, then the pair); everything
 * else moves only on interaction or as it scrolls into view.
 */
export const academyPage = sva({
	slots: [
		"root",
		"rootHome",
		"join",
		"container",
		"hero",
		"system",
		"kicker",
		"title",
		"titleLine",
		"titleAccent",
		"lede",
		"heroLede",
		"indexBand",
		"index",
		"indexLink",
		"indexName",
		"indexWhat",
		"indexArrow",
		"visuallyHidden",
		"pair",
		"pairItem",
		"pairStill",
		"pairChip",
		"pairHead",
		"pairTitle",
		"pairLine",
		"pairWhen",
		"pairLater",
		"spread",
		"plate",
		"plateImage",
		"plateRuntime",
		"colophon",
		"dotLabel",
		"colophonTitle",
		"facts",
		"sectionLead",
		"columns",
		"column",
		"columnHead",
		"entries",
		"entry",
		"entryDate",
		"entryBody",
		"entryTitle",
		"entryMeta",
		"paths",
		"pathsIntro",
		"pathTable",
		"pathTableHead",
		"pathRow",
		"pathRowBody",
		"pathRowName",
		"pathRowMeta",
		"pathRowCount",
		"featureCopy",
		"actions",
		"textLink",
		"featureArt",
		"featureImage",
		"play",
		"section",
		"sectionHead",
		"sectionTitle",
		"sectionLede",
		"feedGrid",
		"card",
		"cardArt",
		"cardImage",
		"cardRuntime",
		"cardBody",
		"cardMeta",
		"cardTitle",
		"cardDescription",
		"resultCount",
		"pathList",
		"pathCard",
		"pathIndex",
		"pathBody",
		"pathTitle",
		"pathMeta",
		"pathLevel",
		"pathLevelBar",
		"pathArrow",
		"watchFeature",
		"watchTitle",
		"streamList",
		"streamFeature",
		"streamMeta",
		"streamTitle",
		"searchBar",
		"input",
		"empty",
		"more",
		"newsletter",
		"newsletterCopy",
		"newsletterForm",
		"newsletterRow",
		"finePrint",
	],
	base: {
		root: {
			backgroundColor: "academy.canvas",
			color: "academy.text",
			fontFamily: "academy-text",
			paddingBottom: "16",
			minWidth: "0",
		},
		// The homepage closes on its own sections, not on the root's padding.
		rootHome: {
			backgroundColor: "academy.canvas",
			color: "academy.text",
			fontFamily: "academy-text",
			minWidth: "0",
		},
		// The newsletter under the homepage. Its card pads itself, so this
		// adds only what brings the gap above it to the section rhythm.
		join: {
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			paddingTop: "4",
			_lg: { paddingTop: "12" },
		},
		container: {
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			width: "full",
		},
		// The Field Index (homepage). The hero is the archive: the statement,
		// one sentence, then the four collections as ruled links. It is kept
		// short enough that the latest session's still shows in the first
		// viewport of a laptop.
		hero: {
			...inkSurface,
			paddingBlockStart: "10",
			// On phones the foot holds one lattice row for the living system:
			// half a cell clear of the lede, one cell of lattice, and room for a
			// node above the edge, so a row lands there at any width.
			paddingBlockEnd: "32",
			_sm: { paddingBlockEnd: "10" },
			// From lg the statement's cap height sits on the first grid line: one
			// cell, less the gap between the line box and the capitals.
			_lg: {
				paddingBlockStart:
					"[calc(4rem - var(--font-sizes-academy-poster) * 0.106)]",
				paddingBlockEnd: "8",
			},
			// Not inkStage: the living-system canvas is absolutely positioned.
			"& > :not(canvas)": { position: "relative" },
		},
		// The living system is drawn on the same lattice as the grid and
		// fades with it, so it reads as the grid coming to life.
		system: {
			position: "absolute",
			inset: "0",
			width: "full",
			height: "full",
			pointerEvents: "none",
			opacity: "0",
			transitionProperty: "[opacity]",
			transitionDuration: "reveal",
			transitionTimingFunction: "academy-out",
			// On phones the system is one row at the hero's foot: not faded.
			maskImage: "none",
			_sm: {
				maskImage:
					"[radial-gradient(140% 120% at 50% 0%, black 65%, transparent 100%)]",
			},
			"&[data-ready]": { opacity: "1" },
			_motionReduce: { transitionDuration: "none" },
		},
		kicker: {
			margin: "0",
			color: "academy.accent",
			fontFamily: "academy-mono",
			fontSize: "sm",
			fontWeight: "medium",
		},
		// The statement is the hero: poster scale, with only the lede under it
		// and the living system on the free lattice beside it.
		title: {
			...posterTitle,
			color: "academy.inkText",
			// Below 350px the poster clamp's floor would break "Understand".
			fontSize: {
				base: "[clamp(2.75rem, 16vw, 3.5rem)]",
				sm: "academy-poster",
			},
		},
		titleLine: {
			display: "block",
			width: "fit-content",
			animation: "academy-rise",
			"&:nth-child(2)": { animationDelay: "stagger-2" },
			_motionReduce: { animation: "none" },
		},
		titleAccent: { color: "academy.inkAccent" },
		lede: { ...ledeText, color: "academy.textSoft" },
		heroLede: {
			...ledeText,
			maxWidth: "[30ch]",
			marginTop: "6",
			color: "academy.inkTextSoft",
			lineHeight: "[1.4]",
			animation: "academy-rise",
			animationDelay: "stagger-3",
			_lg: { marginTop: "10" },
			_motionReduce: { animation: "none" },
		},
		// The field index: its own ink band under the next and latest pair.
		// Each collection by name with its real count as an accent mono
		// superscript (the form its own masthead takes), one line on what is
		// in it, and an arrow. A ruled list, one link per row, with room
		// between the rules.
		indexBand: {
			...inkStage,
			marginTop: "16",
			paddingBlock: "12",
			borderTop: "hairline",
			// One cell of padding, so the rows below sit on the lattice.
			_lg: { marginTop: "24", paddingBlock: "16" },
		},
		index: {
			display: "grid",
			margin: "0",
			padding: "0",
			listStyle: "none",
			// Side longhands: one rule colour whatever order the classes land in.
			borderBottomWidth: "[1px]",
			borderBottomStyle: "solid",
			borderBottomColor: "academy.inkBorder",
			"& > li": {
				borderTopWidth: "[1px]",
				borderTopStyle: "solid",
				borderTopColor: "academy.inkBorder",
				...scrollReveal,
				// Two cells a row: every rule lands on a grid line.
				_lg: { boxSizing: "border-box", blockSize: "32" },
			},
		},
		// A row answers the pointer, the keyboard and a press the same way:
		// the name and the arrow take the accent and travel. Hover is kept to
		// devices that hover, so it never sticks after a tap, and the travel
		// to readers who have not asked for reduced motion.
		indexLink: {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr) auto",
			columnGap: "4",
			rowGap: "2",
			alignItems: "baseline",
			paddingBlock: "5",
			// Inline room, pulled back: the inset focus ring clears the content
			// and the text stays on the column edge.
			paddingInline: "3",
			marginInline: "-3",
			borderRadius: "academy-s",
			color: "academy.inkText",
			textDecoration: "none",
			// From 768 the row is two columns, split where the pair splits (the
			// lg block below takes over at 1024).
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				gridTemplateColumns: "[calc(50% - 0.75rem) minmax(0, 1fr) auto]",
				columnGap: "6",
				alignItems: "last baseline",
			},
			// The description starts on the page's half line, the same x as
			// the pair's second column.
			_lg: {
				height: "full",
				gridTemplateColumns: "[calc(50% - 1.5rem) minmax(0, 1fr) auto]",
				columnGap: "12",
				alignContent: "end",
				// Last baseline: the name sits on the row's bottom line whether
				// its description runs to one line or two.
				alignItems: "last baseline",
				paddingBlockStart: "0",
				paddingBlockEnd: "5",
			},
			// The hover colour steps aside for the press, so the press shows.
			"@media (hover: hover)": {
				"&:hover:not(:active)": {
					"& [data-name], & [data-arrow]": { color: "academy.inkAccent" },
				},
			},
			_focusVisible: {
				...focusRingInk,
				outlineOffset: "focus-inset",
				"& [data-name], & [data-arrow]": { color: "academy.inkAccent" },
			},
			_active: {
				"& [data-name], & [data-arrow]": { color: "academy.inkAccentHover" },
			},
			_motionSafe: {
				"@media (hover: hover)": {
					_hover: {
						"& [data-name]": { transform: "translateX(0.75rem)" },
						"& [data-arrow]": { transform: "translateX(0.375rem)" },
					},
				},
				// The arrow holds still under the ring; it travels on hover only.
				_focusVisible: {
					"& [data-name]": { transform: "translateX(0.75rem)" },
				},
			},
			_motionReduce: {
				"& [data-name], & [data-arrow]": { transitionDuration: "none" },
			},
		},
		indexName: {
			fontFamily: "academy-display",
			fontSize: "4xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-display",
			lineHeight: "none",
			transitionProperty: "[transform, color]",
			transitionDuration: "slow",
			transitionTimingFunction: "academy-out",
			// Stepped with the width, so "Learning paths" holds one line.
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				whiteSpace: "nowrap",
			},
			_lg: { fontSize: "5xl", whiteSpace: "nowrap" },
			"@media (min-width: 1280px)": { fontSize: "6xl" },
			"& sup": {
				position: "relative",
				top: "[0.2em]",
				marginInlineStart: "[0.25em]",
				color: "academy.inkAccent",
				fontFamily: "academy-mono",
				fontSize: "[0.36em]",
				fontWeight: "medium",
				letterSpacing: "[0]",
				lineHeight: "none",
				verticalAlign: "top",
				fontVariantNumeric: "tabular-nums",
			},
		},
		indexWhat: {
			gridColumn: "1 / -1",
			gridRow: "2",
			maxWidth: "[40ch]",
			color: "academy.inkTextSoft",
			fontSize: "sm",
			lineHeight: "body",
			textWrap: "balance",
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				gridColumn: "2",
				gridRow: "1",
			},
			_lg: {
				gridColumn: "2",
				gridRow: "1",
				maxWidth: "[44ch]",
				fontSize: "md",
			},
		},
		indexArrow: {
			justifySelf: "end",
			color: "academy.inkTextMuted",
			fontSize: "xl",
			lineHeight: "none",
			transitionProperty: "[transform, color]",
			transitionDuration: "slow",
			transitionTimingFunction: "academy-out",
		},
		visuallyHidden: { srOnly: true },
		// Next and latest as equals, directly under the hero: two columns of
		// the same width and the same structure (still, label, title, one
		// sentence, facts, action). Beside each other, the columns share their
		// rows through a subgrid, so every part of one sits level with the
		// same part of the other.
		pair: {
			display: "grid",
			// Stacked, the gap between the two is larger than any gap inside one.
			rowGap: "16",
			_sm: {
				gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
				columnGap: "6",
				rowGap: "0",
			},
			_lg: { columnGap: "12" },
		},
		pairItem: {
			display: "grid",
			minWidth: "0",
			alignContent: "start",
			justifyItems: "start",
			animation: "academy-settle",
			animationDelay: "stagger-4",
			"&:nth-child(2)": { animationDelay: "stagger-5" },
			// Still, head, start or facts, action, also scheduled.
			_sm: {
				gridTemplateRows: "subgrid",
				gridRow: "span 5",
				alignContent: "stretch",
			},
			"& > *": { minWidth: "0" },
			// The still and the title are one target: either lights the title,
			// and eases the still for readers who have not asked for less motion.
			"@media (hover: hover)": {
				"&:has(> a[aria-hidden]:hover, [data-title]:hover)": {
					"& [data-title]": { color: "academy.accent" },
				},
			},
			_motionSafe: {
				"@media (hover: hover)": {
					"&:has(> a[aria-hidden]:hover, [data-title]:hover)": {
						"& img": { transform: "scale(1.03)" },
					},
				},
			},
			_motionReduce: { animation: "none" },
		},
		pairStill: {
			...videoFrame,
			gridRow: "1",
			gridColumn: "1",
			width: "full",
			marginBottom: "4",
			borderRadius: "academy-m",
			border: "hairline",
			_motionReduce: { "& img": { transform: "none" } },
		},
		// The kind label is a chip on the still's bottom-start corner: real
		// text, outside the still's hidden link, ink in both schemes. Only the
		// next stream's chip carries the accent dot.
		pairChip: {
			...runtimeBadge,
			position: "relative",
			zIndex: "[1]",
			insetBlockEnd: "auto",
			insetInlineEnd: "auto",
			gridRow: "1",
			gridColumn: "1",
			alignSelf: "end",
			justifySelf: "start",
			display: "inline-flex",
			alignItems: "center",
			gap: "2.5",
			margin: "0",
			marginBottom: "4",
			paddingInline: "3.5",
			paddingBlock: "2.5",
			borderRadius: "[0px]",
			borderStartEndRadius: "academy-m",
			borderEndStartRadius: "academy-m",
			pointerEvents: "none",
			"& [data-dot]": {
				width: "2",
				height: "2",
				flexShrink: "0",
				borderRadius: "full",
				backgroundColor: "academy.inkAccent",
			},
			"& svg": {
				width: "2.5",
				height: "3",
				flexShrink: "0",
				fill: "currentColor",
			},
		},
		// The title and its sentence are one unit: one row of the subgrid, so
		// the sentence sits under its own title whatever the other title does.
		pairHead: {
			display: "grid",
			gap: "2",
			alignContent: "start",
			justifySelf: "stretch",
			minWidth: "0",
			marginTop: "2",
		},
		pairTitle: {
			...headingLg,
			marginTop: "0",
			fontSize: "2xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "[1.1]",
			textWrap: "balance",
			_lg: { fontSize: "3xl" },
			"& [data-title]": {
				color: "inherit",
				textDecoration: "none",
				transitionProperty: "colors",
				transitionDuration: "base",
				transitionTimingFunction: "academy-out",
			},
		},
		pairLine: {
			margin: "0",
			marginTop: "0",
			maxWidth: "[52ch]",
			color: "academy.textSoft",
			lineHeight: "body",
			textWrap: "pretty",
		},
		// The next stream's facts are its start: the day at numeral scale,
		// then the weekday and the time in the reader's zone over the month
		// and year. It is ruled above and below like the fact list it sits
		// beside. One time element holds it; the visible parts are hidden
		// from assistive technology, which reads the whole start as a phrase.
		pairWhen: {
			// Stretched to the fact list beside it, with the start centred
			// between its two rules.
			display: "grid",
			alignContent: "center",
			alignSelf: "stretch",
			width: "full",
			margin: "0",
			marginTop: "6",
			marginBottom: "7",
			paddingBlock: "4",
			borderBlock: "hairline",
			"& [data-visible]": {
				display: "flex",
				alignItems: "center",
				columnGap: "5",
			},
			"& strong": {
				display: "block",
				marginInlineStart: "[-0.04em]",
				color: "academy.text",
				fontFamily: "academy-display",
				fontSize: "[clamp(5.5rem, 9vw, 7.5rem)]",
				fontWeight: "extrabold",
				letterSpacing: "academy-display",
				lineHeight: "[0.8]",
				fontVariantNumeric: "tabular-nums",
			},
			"& [data-date]": {
				display: "grid",
				gap: "1",
				color: "academy.textMuted",
				fontFamily: "academy-mono",
				fontSize: "xs",
				lineHeight: "body",
			},
			// The time keeps its zone: the lead line breaks after the comma only.
			"& [data-time]": { whiteSpace: "nowrap" },
			"& [data-date] > [data-lead]": {
				color: "academy.text",
				fontFamily: "academy-text",
				fontSize: "md",
				fontWeight: "medium",
			},
		},
		// Streams scheduled after the next one: a short ruled list under it.
		pairLater: {
			display: "grid",
			width: "full",
			marginTop: "8",
			"& p": { ...monoMeta, paddingBlockEnd: "2" },
			"& ul": {
				display: "grid",
				margin: "0",
				padding: "0",
				listStyle: "none",
				borderBottom: "hairline",
			},
			"& a": {
				display: "grid",
				rowGap: "0.5",
				columnGap: "4",
				alignItems: "baseline",
				paddingBlock: "3",
				borderTop: "hairline",
				color: "academy.text",
				fontWeight: "semibold",
				lineHeight: "academy-card",
				textDecoration: "none",
				transitionProperty: "colors",
				transitionDuration: "base",
				// Time beside title only where the column can hold both.
				"@media (min-width: 1280px)": {
					gridTemplateColumns: "13.5rem minmax(0, 1fr)",
				},
				"@media (hover: hover)": {
					"&:hover:not(:active)": { color: "academy.accent" },
				},
				_focusVisible: focusRing,
				_active: { color: "academy.accentHover" },
			},
			"& time": {
				color: "academy.textMuted",
				fontFamily: "academy-mono",
				fontSize: "xs",
				fontWeight: "normal",
			},
		},
		// The latest session as a spread: the still as a plate, then a
		// colophon of facts and the page's one solid action.
		spread: {
			display: "grid",
			gap: "7",
			alignItems: "start",
			animation: "academy-settle",
			animationDelay: "stagger-4",
			// The plate takes the page's half, as a pair still does, and the
			// colophon starts on the half line with the index descriptions.
			_lg: {
				gridTemplateColumns: "[calc(50% - 1.5rem) minmax(0, 1fr)]",
				columnGap: "12",
			},
			// As in the pair: the plate and the title are one target.
			"@media (hover: hover)": {
				"&:has(> a[aria-hidden]:hover, [data-title]:hover)": {
					"& [data-title]": { color: "academy.accent" },
				},
			},
			_motionSafe: {
				"@media (hover: hover)": {
					"&:has(> a[aria-hidden]:hover, [data-title]:hover)": {
						"& img": { transform: "scale(1.03)" },
					},
				},
			},
			_motionReduce: { animation: "none" },
		},
		plate: {
			...videoFrame,
			borderRadius: "academy-m",
			border: "hairline",
			_motionReduce: { "& img": { transform: "none" } },
		},
		plateImage: coverImageZoom,
		// Set over the leading corner, with a play mark: the still is the way in.
		plateRuntime: {
			...runtimeBadge,
			insetBlockEnd: "0",
			insetInlineEnd: "auto",
			insetInlineStart: "0",
			display: "inline-flex",
			alignItems: "center",
			gap: "2.5",
			paddingInline: "3.5",
			paddingBlock: "2.5",
			borderRadius: "[0px]",
			borderStartEndRadius: "academy-m",
			"& svg": {
				width: "2.5",
				height: "3",
				fill: "academy.inkAccent",
			},
		},
		colophon: { display: "grid", minWidth: "0", justifyItems: "start" },
		// A kind label in the colophon: a hollow ring and the words. The
		// accent dot belongs to the next stream's chip alone.
		dotLabel: {
			...monoMeta,
			display: "flex",
			alignItems: "center",
			gap: "2",
			"&::before": {
				content: '""',
				width: "2",
				height: "2",
				flexShrink: "0",
				borderRadius: "full",
				backgroundColor: "transparent",
				border: "hairline",
				borderColor: "academy.textMuted",
			},
		},
		colophonTitle: {
			...headingLg,
			marginTop: "3",
			fontSize: "3xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "[1.05]",
			textWrap: "balance",
			_lg: { fontSize: "4xl", letterSpacing: "academy-display" },
			"& [data-title]": {
				color: "inherit",
				textDecoration: "none",
				transitionProperty: "colors",
				transitionDuration: "base",
				transitionTimingFunction: "academy-out",
			},
		},
		facts: {
			display: "grid",
			width: "full",
			margin: "0",
			marginTop: "6",
			marginBottom: "7",
			borderBottom: "hairline",
			"& > div": {
				display: "grid",
				gridTemplateColumns: "6.5rem minmax(0, 1fr)",
				columnGap: "3",
				alignItems: "baseline",
				paddingBlock: "2",
				borderTop: "hairline",
			},
			"& dt": monoMeta,
			"& dd": { margin: "0", fontWeight: "medium" },
			// Padded and pulled back, so the link is 24px tall without moving.
			"& dd a": {
				display: "inline-block",
				paddingBlock: "1",
				marginBlock: "-1",
				color: "inherit",
				textDecorationColor: "academy.textMuted",
				textUnderlineOffset: "0.2em",
				transitionProperty: "colors",
				transitionDuration: "base",
				"@media (hover: hover)": {
					"&:hover:not(:active)": { color: "academy.accent" },
				},
				_focusVisible: focusRing,
				_active: { color: "academy.accentHover" },
			},
			// A count beside its link stays whole: beside it, or under it.
			"& dd:has(small)": {
				display: "flex",
				flexWrap: "wrap",
				alignItems: "baseline",
				columnGap: "2",
			},
			"& dd small": {
				whiteSpace: "nowrap",
				color: "academy.textMuted",
				fontFamily: "academy-mono",
				fontSize: "xs",
				fontWeight: "normal",
			},
		},
		// The first section under the hero sits closer to it than the rest.
		sectionLead: {
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			paddingTop: "10",
		},
		// Recently published: one column per collection that has something
		// new, each the same thing: the same width, the same number of rows,
		// the same row. An empty collection has no column, so the ledger never
		// shows a blank one.
		//
		// From lg, three share the measure in thirds, two in halves, and one
		// runs the full measure with its rows two abreast. The columns share
		// one set of rows through a subgrid (the name, LEDGER_ROWS entries,
		// the closing link), so every rule and every closing link runs level
		// across them. From sm to lg each column is the same rail: its name
		// and closing link on the left, its rows on the right.
		columns: {
			display: "grid",
			rowGap: "12",
			columnGap: "6",
			_sm: { gridTemplateColumns: "minmax(0, 1fr)" },
			_lg: {
				columnGap: "10",
				rowGap: "0",
				"&[data-columns='3']": {
					gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
				},
				"&[data-columns='2']": {
					gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
				},
			},
		},
		// A column with fewer than three rows keeps its own rows: its closing
		// link follows its last row instead of being stranded at the foot.
		column: {
			display: "grid",
			gridTemplateRows: "auto 1fr auto",
			minWidth: "0",
			"&[data-short]": { alignSelf: "start" },
			_sm: {
				gridTemplateColumns: "minmax(0, 3fr) minmax(0, 9fr)",
				gridTemplateRows: "auto 1fr",
				columnGap: "6",
				"& > [data-more]": {
					gridColumn: "1",
					gridRow: "2",
					alignSelf: "start",
				},
			},
			// 7 = the name + LEDGER_ROWS (5, in the homepage's index.astro) +
			// the closing link. Change them together.
			_lg: {
				gridTemplateColumns: "minmax(0, 1fr)",
				gridTemplateRows: "auto 1fr auto",
				gridRow: "span 7",
				"&:not([data-short])": { gridTemplateRows: "subgrid" },
				"& > [data-more]": {
					gridColumn: "auto",
					gridRow: "auto",
					alignSelf: "auto",
				},
			},
		},
		columnHead: {
			margin: "0",
			paddingBlockEnd: "2.5",
			borderBottom: "academy-tab",
			borderColor: "academy.text",
			fontFamily: "academy-display",
			fontSize: "2xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "tight",
			_sm: { gridColumn: "1", gridRow: "1", alignSelf: "start" },
			_lg: { gridColumn: "auto", gridRow: "auto", alignSelf: "auto" },
		},
		entries: {
			display: "grid",
			alignContent: "start",
			margin: "0",
			padding: "0",
			listStyle: "none",
			// The rule is the item's; the link inside it bleeds past the rule.
			"& > li": { borderBottom: "hairline" },
			_sm: { gridColumn: "2", gridRow: "1 / -1" },
			_lg: {
				gridColumn: "auto",
				gridRow: "auto",
				"& > li": { display: "grid" },
				// 5 = LEDGER_ROWS in the homepage's index.astro.
				"&:not([data-wide])": {
					gridRow: "span 5",
					gridTemplateRows: "subgrid",
				},
				"&[data-wide]": {
					gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
					columnGap: "6",
				},
			},
		},
		// One compact ledger row: the day as a numeral with month and year
		// beneath it, then the title and one mono line of facts.
		entry: {
			display: "grid",
			gridTemplateColumns: "3.75rem minmax(0, 1fr)",
			columnGap: "3.5",
			alignItems: "start",
			height: "full",
			paddingBlock: "4",
			// Inline room, pulled back: the inset focus ring clears the content.
			paddingInline: "3",
			marginInline: "-3",
			borderRadius: "academy-s",
			color: "academy.text",
			textDecoration: "none",
			...scrollReveal,
			"@media (hover: hover)": {
				"&:hover:not(:active)": {
					"& [data-title]": { color: "academy.accent" },
				},
			},
			_focusVisible: {
				...focusRingInset,
				"& [data-title]": { color: "academy.accent" },
			},
			_active: { "& [data-title]": { color: "academy.accentHover" } },
			_motionSafe: {
				"@media (hover: hover)": {
					_hover: { "& [data-body]": { transform: "translateX(0.25rem)" } },
				},
				_focusVisible: {
					"& [data-body]": { transform: "translateX(0.25rem)" },
				},
			},
			_motionReduce: { animation: "none" },
		},
		entryDate: {
			display: "grid",
			gap: "1",
			color: "academy.textMuted",
			fontFamily: "academy-mono",
			fontSize: "xs",
			lineHeight: "body",
			whiteSpace: "nowrap",
			"& strong": {
				color: "academy.text",
				fontFamily: "academy-display",
				fontSize: "xl",
				fontWeight: "extrabold",
				letterSpacing: "academy-tight",
				lineHeight: "none",
				fontVariantNumeric: "tabular-nums",
			},
		},
		entryBody: {
			display: "grid",
			gap: "1",
			minWidth: "0",
			transitionProperty: "[transform]",
			transitionDuration: "slow",
			transitionTimingFunction: "academy-out",
			_motionReduce: { transitionDuration: "none" },
		},
		entryTitle: {
			fontSize: "md",
			fontWeight: "semibold",
			lineHeight: "academy-card",
			textWrap: "pretty",
			overflowWrap: "anywhere",
			transitionProperty: "colors",
			transitionDuration: "base",
			transitionTimingFunction: "academy-out",
		},
		entryMeta: monoMeta,
		// Learning paths as a ruled table: the path, then how many sessions
		// it puts in order. From lg it shares the ledger's three tracks: the
		// introduction in the first, the table from the second.
		paths: {
			display: "grid",
			rowGap: "7",
			alignItems: "start",
			_lg: {
				gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
				columnGap: "10",
				"& > :last-child": { gridColumn: "2 / -1" },
			},
		},
		pathsIntro: {
			display: "grid",
			gap: "3",
			justifyItems: "start",
			"& p": {
				margin: "0",
				maxWidth: "[46ch]",
				color: "academy.textSoft",
				lineHeight: "body",
				textWrap: "balance",
				_lg: { maxWidth: "[28ch]" },
			},
		},
		pathTable: {
			display: "grid",
			margin: "0",
			padding: "0",
			listStyle: "none",
			"& > li": { borderBottom: "hairline" },
		},
		pathTableHead: {
			...monoMeta,
			display: "flex",
			justifyContent: "space-between",
			columnGap: "4",
			paddingBlockEnd: "2.5",
			borderBottom: "academy-tab",
			borderColor: "academy.text",
		},
		pathRow: {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr) auto",
			columnGap: "6",
			alignItems: "center",
			paddingBlock: "4",
			// Inline room, pulled back: the inset focus ring clears the content.
			paddingInline: "3",
			marginInline: "-3",
			borderRadius: "academy-s",
			color: "academy.text",
			textDecoration: "none",
			_lg: { paddingBlock: "5" },
			...scrollReveal,
			"@media (hover: hover)": {
				"&:hover:not(:active)": {
					"& [data-name], & strong": { color: "academy.accent" },
				},
			},
			_focusVisible: {
				...focusRingInset,
				"& [data-name], & strong": { color: "academy.accent" },
			},
			_active: {
				"& [data-name], & strong": { color: "academy.accentHover" },
			},
			_motionSafe: {
				"@media (hover: hover)": {
					_hover: { "& [data-name]": { transform: "translateX(0.5rem)" } },
				},
				_focusVisible: {
					"& [data-name]": { transform: "translateX(0.5rem)" },
				},
			},
			_motionReduce: {
				animation: "none",
				"& [data-name]": { transitionDuration: "none" },
			},
		},
		pathRowBody: { display: "grid", gap: "1.5", minWidth: "0" },
		pathRowName: {
			fontFamily: "academy-display",
			fontSize: "2xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "[1.1]",
			textWrap: "balance",
			transitionProperty: "[transform, color]",
			transitionDuration: "slow",
			transitionTimingFunction: "academy-out",
			_lg: { fontSize: "3xl" },
		},
		pathRowMeta: monoMeta,
		// The count is a numeral alone; the column's head names its unit once.
		pathRowCount: {
			justifySelf: "end",
			textAlign: "end",
			"& strong": {
				display: "block",
				color: "academy.text",
				fontFamily: "academy-display",
				fontSize: "academy-numeral",
				fontWeight: "extrabold",
				letterSpacing: "academy-display",
				lineHeight: "none",
				fontVariantNumeric: "tabular-nums",
				transitionProperty: "colors",
				transitionDuration: "base",
			},
		},
		featureCopy: {
			display: "grid",
			gap: "4",
			minWidth: "0",
			alignContent: "center",
		},
		actions: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "4",
			marginTop: "2",
			animation: "academy-rise",
			animationDelay: "stagger-3",
			_motionReduce: { animation: "none" },
		},
		textLink: textLink,
		featureArt: {
			...videoFrame,
			backgroundColor: "academy.inkRaised",
			borderRadius: "academy-m",
			border: "hairline",
			borderColor: "academy.inkBorder",
		},
		featureImage: coverImageZoom,
		play: {
			position: "absolute",
			insetBlockStart: "[50%]",
			insetInlineStart: "[50%]",
			display: "grid",
			placeItems: "center",
			width: "16",
			height: "16",
			marginBlockStart: "-8",
			marginInlineStart: "-8",
			borderRadius: "full",
			backgroundColor: "academy.inkAccent",
			color: "academy.inkAccentForeground",
			transitionProperty: "[transform]",
			transitionDuration: "slow",
			transitionTimingFunction: "academy-out",
			"& svg": { width: "6", height: "6", marginInlineStart: "0.5" },
			_motionReduce: { transitionDuration: "none" },
		},
		section: {
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
			paddingTop: "16",
			_lg: { paddingTop: "24" },
		},
		sectionHead: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "end",
			justifyContent: "space-between",
			columnGap: "6",
			rowGap: "3",
			marginBottom: "8",
			"& > div": { display: "grid", gap: "3" },
		},
		sectionTitle: sectionTitle,
		sectionLede: {
			margin: "0",
			maxWidth: "academy-lede",
			color: "academy.textSoft",
			fontSize: "md",
			lineHeight: "academy-reading",
		},
		feedGrid: {
			display: "grid",
			gap: "8",
			_sm: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
			_lg: {
				gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
				columnGap: "7",
				rowGap: "10",
			},
		},
		card: {
			display: "flex",
			flexDirection: "column",
			minWidth: "0",
			gap: "3",
			color: "academy.text",
			textDecoration: "none",
			...scrollReveal,
			_motionReduce: { animation: "none" },
			_hover: {
				"& h3": { color: "academy.accent" },
				"& img": { transform: "scale(1.03)" },
			},
			_focusVisible: focusRing,
		},
		cardArt: { ...videoFrame, borderRadius: "academy-m" },
		cardImage: coverImageZoom,
		cardRuntime: runtimeBadge,
		cardBody: { display: "grid", gap: "2", alignContent: "start" },
		cardMeta: {
			...monoMeta,
			display: "flex",
			flexWrap: "wrap",
			alignItems: "baseline",
			columnGap: "2",
			rowGap: "1",
			fontVariantNumeric: "tabular-nums",
		},
		cardTitle: { ...cardTitle, color: "academy.text" },
		cardDescription: {
			margin: "0",
			color: "academy.textSoft",
			fontSize: "sm",
			lineHeight: "academy-reading",
			textWrap: "pretty",
		},
		// Collection pages open in ink, like the homepage, with the title at
		// masthead scale and the collection's real size as a numeral.
		resultCount: { margin: "0", color: "academy.textMuted", fontSize: "sm" },
		pathList: ruledList,
		pathCard: {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr) auto",
			gap: "4",
			alignItems: "start",
			paddingBlock: "6",
			borderBottom: "hairline",
			borderColor: "academy.border",
			color: "academy.text",
			textDecoration: "none",
			_lg: {
				gridTemplateColumns: "8rem minmax(0, 1fr) auto",
				gap: "8",
				paddingBlock: "8",
			},
			...scrollReveal,
			_hover: {
				"& :is(h2, h3)": { color: "academy.accent" },
				"& [data-arrow]": { transform: "translate(0.15em, -0.15em)" },
				"& [data-index]": { color: "academy.accent" },
			},
			_focusVisible: focusRing,
			_motionReduce: { animation: "none" },
		},
		// A ghost numeral: large, quiet, and lit on hover.
		pathIndex: {
			display: "none",
			color: "academy.segmentOff",
			fontFamily: "academy-display",
			fontSize: "academy-numeral",
			fontWeight: "extrabold",
			letterSpacing: "academy-poster",
			lineHeight: "none",
			fontVariantNumeric: "tabular-nums",
			transitionProperty: "colors",
			transitionDuration: "base",
			_lg: { display: "block" },
		},
		pathBody: {
			display: "grid",
			gap: "2",
			maxWidth: "academy-copy",
			minWidth: "0",
		},
		pathTitle: {
			margin: "0",
			fontFamily: "academy-display",
			fontSize: "xl",
			fontWeight: "bold",
			lineHeight: "academy-card",
			letterSpacing: "academy-tight",
			transitionProperty: "colors",
			transitionDuration: "base",
			_lg: { fontSize: "2xl" },
		},
		pathMeta: {
			...monoMeta,
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "3",
			marginTop: "2",
		},
		pathLevel: {
			display: "inline-flex",
			alignItems: "flex-end",
			gap: "0.5",
			height: "3",
			marginInlineEnd: "1",
		},
		pathLevelBar: {
			display: "block",
			width: "1",
			height: "full",
			borderRadius: "xs",
			backgroundColor: "academy.segmentOff",
			"&:nth-child(1)": { height: "1.5" },
			"&:nth-child(2)": { height: "2.5" },
			"&[data-on='true']": { backgroundColor: "academy.accent" },
		},
		pathArrow: {
			display: "inline-block",
			color: "academy.accent",
			fontSize: "2xl",
			lineHeight: "none",
			transitionProperty: "[transform]",
			transitionDuration: "base",
			transitionTimingFunction: "academy-out",
			_motionReduce: { transitionDuration: "none" },
		},
		watchFeature: {
			display: "grid",
			gap: "6",
			alignItems: "center",
			color: "academy.text",
			textDecoration: "none",
			_lg: { gridTemplateColumns: "1.1fr 1fr", gap: "10" },
			_hover: {
				"& h2": { color: "academy.accent" },
				"& img": { transform: "scale(1.03)" },
				"& [data-play]": { transform: "scale(1.08)" },
			},
			_focusVisible: focusRing,
		},
		watchTitle: {
			...sectionTitle,
			letterSpacing: "academy-tight",
			transitionProperty: "colors",
			transitionDuration: "base",
		},
		// One or two scheduled streams are set as horizontal features: the
		// still, then the label and start time, the title, one sentence and
		// the action. Three or more fall back to the card grid.
		streamList: { display: "grid", gap: "10" },
		streamFeature: {
			display: "grid",
			gap: "5",
			alignItems: "center",
			color: "academy.text",
			textDecoration: "none",
			_sm: {
				gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
				gap: "8",
			},
			_lg: {
				gridTemplateColumns: "minmax(0, 30rem) minmax(0, 1fr)",
				gap: "10",
			},
			_hover: {
				"& h3": { color: "academy.accent" },
				"& img": { transform: "scale(1.03)" },
			},
			_focusVisible: focusRing,
		},
		// The label and the start time are separate items, so a wrap falls
		// between them and never strands a separator.
		streamMeta: {
			...monoMeta,
			display: "flex",
			flexWrap: "wrap",
			columnGap: "4",
			rowGap: "1",
			"& [data-label]": { color: "academy.accent" },
		},
		streamTitle: {
			...headingLg,
			letterSpacing: "academy-tight",
			textWrap: "balance",
			transitionProperty: "colors",
			transitionDuration: "base",
			_lg: { fontSize: "3xl" },
		},
		searchBar: {
			display: "grid",
			alignItems: "center",
			gap: "3",
			marginBottom: "8",
			"& label": { fontSize: "sm", fontWeight: "semibold" },
			_sm: { gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: "5" },
		},
		input: {
			...inputField,
			minHeight: "12",
			paddingInline: "4",
			paddingBlock: "3",
			fontFamily: "academy-text",
			fontSize: "md",
		},
		empty: { paddingBlock: "10", color: "academy.textSoft" },
		more: {
			display: "grid",
			justifyItems: "center",
			gap: "3",
			marginTop: "10",
		},
		newsletter: {
			display: "grid",
			gap: "8",
			maxWidth: "academy-shell",
			marginInline: "auto",
			marginTop: "20",
			paddingInline: "academy-gutter",
			paddingBlock: "12",
			borderTop: "hairline",
			borderColor: "academy.border",
			_lg: {
				gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
				gap: "16",
				alignItems: "center",
				paddingBlock: "16",
			},
		},
		newsletterCopy: { display: "grid", gap: "3" },
		newsletterForm: {
			display: "grid",
			gap: "3",
			"& label": {
				color: "academy.text",
				fontSize: "sm",
				fontWeight: "semibold",
			},
		},
		newsletterRow: {
			display: "grid",
			gap: "3",
			_sm: { gridTemplateColumns: "minmax(0, 1fr) auto" },
		},
		finePrint: {
			margin: "0",
			color: "academy.textMuted",
			fontSize: "xs",
			lineHeight: "body",
			"& a": { color: "inherit", textUnderlineOffset: "0.2em" },
		},
	},
});
