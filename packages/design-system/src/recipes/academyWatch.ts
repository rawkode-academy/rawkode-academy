import { sva } from "../../styled-system/css";
import { focusRing, focusRingInk, focusRingInset } from "../styles/focus";
import { inputField } from "../styles/field";
import { coverImage, coverImageZoom, videoFrame } from "../styles/media";
import { panelSurface } from "../styles/surface";
import { systemGridBottom } from "../styles/systemGrid";
import { ledeText, monoMeta } from "../styles/type";
import { watchFeedback, watchLedger } from "../styles/watch";

/**
 * The workbench: the Academy watch route as two panes.
 *
 * From `lg` the player is pinned in an ink pane on the left with the
 * session's title, technologies and what to watch next; the canvas pane on
 * the right holds the working notes in order. The vertical edge between
 * them is the composition, and the system grid lives only in the ink pane.
 * Below `lg` it is one column: the player sticks to the top and shrinks to
 * a strip as the page scrolls (scroll-driven; where scroll timelines are
 * unsupported or motion is reduced the player scrolls away with the page).
 *
 * This page is the one deliberate exception to the 1180px shell: the split
 * is full bleed, and the content of each pane is aligned so the ink pane's
 * left edge and the canvas pane's right edge sit on the shell edges.
 *
 * Markup contract:
 *
 *   <div class={root}>
 *     <div class={bench}>
 *       <div class={pane}><div class={paneSticky}><div class={paneInner}>
 *         <div class={deck}><div class={deckInner}>
 *           <div class={playerFrame}>…player…</div>
 *           <div class={strip}>…</div>
 *         </div></div>
 *         <div class={deckSpace} />
 *         <header class={session}>…</header>
 *       </div></div></div>
 *       <div class={notes}><div class={notesInner}>…</div></div>
 *       <aside class={more} data-watch-more><div class={moreInner}>…</div></aside>
 *     </div>
 *     <div class={outro}>…newsletter…</div>
 *   </div>
 *
 * `bench` takes `data-pin` when "more from" exists and may be pinned, and
 * `data-notice` when the session carries the upcoming-stream notice. The
 * website's `fitWatchPane` adds `data-pane-flow` ("more" or "all") when the
 * measured session does not fit the pinned pane.
 *
 * Playback, deferred islands and route data remain owned by the website.
 */
export const academyWatch = sva({
	slots: [
		"root",
		"bench",
		"pane",
		"paneSticky",
		"paneInner",
		"deck",
		"deckInner",
		"deckSpace",
		"playerFrame",
		"poster",
		"noscript",
		"noscriptLinks",
		"upcomingThumbnail",
		"strip",
		"stripLink",
		"stripTitle",
		"stripTime",
		"session",
		"breadcrumb",
		"breadcrumbStatus",
		"title",
		"meta",
		"metaKind",
		"upcoming",
		"noticeTitle",
		"noticeCopy",
		"factLink",
		"tools",
		"toolsEnd",
		"more",
		"moreInner",
		"extrasBlock",
		"inkHeader",
		"inkHeading",
		"inkLink",
		"techGrid",
		"techChip",
		"techIcon",
		"techName",
		"upNextList",
		"upNextLink",
		"upNextStill",
		"upNextImage",
		"upNextBody",
		"upNextMeta",
		"upNextTitle",
		"notes",
		"notesInner",
		"lede",
		"description",
		"section",
		"sectionTitle",
		"learnList",
		"linkList",
		"linkRow",
		"linkKind",
		"linkBody",
		"linkName",
		"linkNote",
		"linkArrow",
		"castGrid",
		"castCard",
		"castAvatar",
		"castInitials",
		"castBody",
		"castName",
		"castMeta",
		"castHandle",
		"outro",
		"chapterList",
		"chapterLink",
		"chapterTime",
		"chapterName",
		"transcript",
		"transcriptNote",
		"fieldLabel",
		"search",
		"searchInput",
		"searchIcon",
		"searchSummary",
		"transcriptContainer",
		"transcriptBody",
		"transcriptChapter",
		"transcriptChapterLink",
		"transcriptParagraph",
		"transcriptTimestamp",
		"transcriptTimestampLink",
		"transcriptHighlight",
		"player",
		"playerSurface",
		"livePlayer",
		"livePlayerVideo",
		"livePlayerStatus",
		"discussion",
		"reactions",
		"reactionList",
		"reactionButton",
		"reactionEmoji",
		"reactionCount",
		"reactionPicker",
		"emojiOption",
		"tabsRoot",
		"resourceGroups",
		"resourceGroup",
		"resourceHeading",
		"resourceList",
		"resourceLink",
		"resourceIcon",
		"resourceBody",
		"resourceTitle",
		"resourceDescription",
		"resourceExternal",
		"comments",
		"commentsTitle",
		"commentList",
		"comment",
		"commentRow",
		"commentAvatar",
		"commentAvatarFallback",
		"commentContent",
		"commentMeta",
		"commentAuthor",
		"commentDate",
		"commentBody",
		"commentCta",
		"progress",
		"progressTrack",
		"progressFill",
		"progressLabel",
	],
	base: {
		root: {
			// The strip the narrow player shrinks to, and its full height:
			// 16:9 of the viewport width (full bleed), capped by the viewport
			// height so a landscape phone still shows the title beneath it.
			"--watch-strip": "3.5rem",
			"--watch-full": "min(56.25vw, 70svh)",
			backgroundColor: "academy.canvas",
			color: "academy.text",
			fontFamily: "academy-text",
			"& [data-watch-player-frame]:has(media-player, video, iframe, [data-watch-upcoming-thumbnail]) [data-watch-player-poster]":
				{
					display: "none",
				},
		},
		// One column until `lg`, then the split. The outer tracks grow past
		// 1180px so each pane bleeds to its edge of the window while its
		// content stays on the shell.
		//
		// Source order is the reading order at every width: player, session,
		// notes, then "more from". From `lg` the last is placed back in the
		// ink column by the grid. `--watch-rest` is everything in the first
		// viewport that is not the player (the site header, the session and,
		// when it is pinned, "more from"); the player takes what is left.
		bench: {
			"--watch-rest": "23.25rem",
			display: "flex",
			flexDirection: "column",
			timelineScope: "--watch-deck",
			"&[data-notice]": { "--watch-rest": "34.25rem" },
			_lg: {
				display: "grid",
				gridTemplateColumns:
					"[minmax(0, 1fr) minmax(0, 708px) minmax(0, 472px) minmax(0, 1fr)]",
				gridTemplateRows: "[1fr auto]",
				// The player's width, shared by both ink blocks so they end on
				// one edge. `100%` resolves where it is used: `paneInner` and
				// `moreInner` have the same content width.
				"--watch-player-cap":
					"max(18rem, calc((100dvh - var(--watch-rest)) * 16 / 9))",
				"--watch-player-w": "min(100%, var(--watch-player-cap))",
				// It narrows in whole 4rem cells, so its right edge stays on a
				// lattice line. Rounding up only makes it smaller.
				// (Doubled selector: the generated rule is emitted before the
				// plain `lg` one and would otherwise lose to it.)
				"@supports (width: round(up, 1px, 1px))": {
					"&&": {
						"--watch-player-w":
							"calc(100% - round(up, max(0px, 100% - var(--watch-player-cap)), 4rem))",
					},
				},
				// Measured (`fitWatchPane`): the session is taller than the first
				// viewport, so the pane scrolls with the page.
				"&[data-pane-flow=all] [data-watch-pane-sticky]": {
					position: "static",
					overflow: "visible",
				},
			},
			// A viewport with room pins "more from" to the foot of the ink
			// pane, so the pane is a complete side of the bench. A shorter one
			// leaves it at the end of the column, where the page scrolls to it;
			// nothing ever scrolls inside the pane. `data-pane-flow` is set by
			// `fitWatchPane` when the session's own content does not leave the
			// room the tier assumed: the block then falls back to row 2. The
			// player keeps its size either way.
			//
			// Laptop heights pin one row, without its still.
			"@media (min-width: 1024px) and (min-height: 46rem) and (max-height: 53.99rem)":
				{
					"&[data-pin]": { "--watch-rest": "30.5rem" },
					"&[data-pin]:not([data-pane-flow]) > [data-watch-pane]": { gridRow: "1 / 3" },
					"&[data-pin]:not([data-pane-flow]) > [data-watch-more]": {
						gridRow: "1 / 3",
						alignSelf: "end",
						position: "sticky",
						bottom: "0",
						paddingBlockEnd: "4",
						borderInlineEndColor: "transparent",
						backgroundColor: {
							base: "academy.ink",
							_dark: "academy.inkRaised",
						},
					},
					"&[data-pin]:not([data-pane-flow]) > [data-watch-more] li:nth-child(n + 2)": {
						display: "none",
					},
					"&[data-pin]:not([data-pane-flow]) > [data-watch-more] [data-still]": { display: "none" },
					"&[data-pin]:not([data-pane-flow]) > [data-watch-more] [data-up-next-link]": {
						gridTemplateColumns: "minmax(0, 1fr)",
					},
				},
			// A short viewport cannot hold the upcoming notice beside the
			// player: the pane scrolls with the page so "Notify me" is reachable.
			"@media (min-width: 1024px) and (max-height: 56rem)": {
				"&[data-notice] [data-watch-pane-sticky]": { position: "static" },
			},
			"@media (min-width: 1024px) and (min-height: 54rem)": {
				"&[data-pin]": { "--watch-rest": "37.5rem" },
				"&[data-pin]:not([data-pane-flow]) > [data-watch-pane]": { gridRow: "1 / 3" },
				"&[data-pin]:not([data-pane-flow]) > [data-watch-more]": {
					gridRow: "1 / 3",
					alignSelf: "end",
					position: "sticky",
					bottom: "0",
					paddingBlockEnd: "4",
					borderInlineEndColor: "transparent",
					backgroundColor: {
						base: "academy.ink",
						_dark: "academy.inkRaised",
					},
				},
				// Two rows until the viewport has room for the third.
				"&[data-pin]:not([data-pane-flow]) > [data-watch-more] li:nth-child(n + 3)": {
					display: "none",
				},
			},
			"@media (min-width: 1024px) and (min-height: 62rem)": {
				"&[data-pin]": { "--watch-rest": "41.75rem" },
				"&[data-pin]:not([data-pane-flow]) > [data-watch-more] li:nth-child(n + 3)": {
					display: "block",
				},
			},
		},
		// Below `lg` the pane and its wrappers dissolve so the player can
		// stick against the whole page.
		pane: {
			display: "contents",
			_lg: {
				display: "block",
				gridColumn: "1 / 3",
				gridRow: "1",
				minWidth: "0",
				// In dark the ink token is one step from the canvas, so the pane
				// takes the raised panel colour and the edge stays a clear rule.
				backgroundColor: { base: "academy.ink", _dark: "academy.inkRaised" },
				color: "academy.inkText",
				borderInlineEnd: "hairline",
				borderInlineEndColor: "academy.inkBorder",
			},
		},
		paneSticky: {
			display: "contents",
			_lg: {
				display: "block",
				position: "sticky",
				top: "0",
				minHeight: "[100dvh]",
				overflow: "hidden",
				...systemGridBottom,
				// The lattice is registered to the seam: one line lies on the
				// player's right border, and none sits beside the pane's own rule.
				_before: {
					...systemGridBottom._before,
					backgroundPosition: "[right calc(2.5rem + 1px) bottom]",
				},
			},
		},
		// The player narrows on a short viewport so the pane always fits
		// under the site header; the pane has no scroll of its own.
		paneInner: {
			display: "contents",
			_lg: {
				position: "relative",
				display: "flex",
				flexDirection: "column",
				width: "full",
				// The 708px track less the pane's own rule.
				maxWidth: "[707px]",
				marginInlineStart: "auto",
				// The player's top edge and the first line of the notes share a line.
				paddingBlockStart: "8",
				paddingBlockEnd: "5",
				paddingInlineStart: "academy-gutter",
				paddingInlineEnd: "10",
			},
		},
		deck: {
			position: "relative",
			flexShrink: "0",
			height: "[var(--watch-full)]",
			backgroundColor: "academy.ink",
			"@media screen and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)":
				{
					"@supports (animation-timeline: view())": {
						position: "sticky",
						top: "0",
						zIndex: "[20]",
						height: "[var(--watch-strip)]",
					},
				},
			_lg: {
				width: "[var(--watch-player-w)]",
				height: "auto",
				aspectRatio: "academy-video",
				backgroundColor: "transparent",
			},
		},
		deckInner: {
			position: "absolute",
			insetInline: "0",
			top: "0",
			display: "flex",
			height: "full",
			overflow: "hidden",
			backgroundColor: "academy.ink",
			"@media screen and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)":
				{
					"@supports (animation-timeline: view())": {
						height: "[var(--watch-full)]",
						borderBottom: "hairline",
						borderBottomColor: "academy.inkBorder",
						animation: "[academy-watch-shrink linear both]",
						animationTimeline: "--watch-deck",
						animationRange: "exit 0% exit 100%",
					},
				},
			_lg: { backgroundColor: "transparent" },
		},
		// The room the full-size player takes in the page. Its exit from the
		// viewport (measured below the strip) is the timeline the player
		// shrinks along, so the page needs no header height.
		deckSpace: {
			display: "none",
			"@media screen and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)":
				{
					"@supports (animation-timeline: view())": {
						display: "block",
						flexShrink: "0",
						height: "[calc(var(--watch-full) - var(--watch-strip))]",
						backgroundColor: "academy.ink",
						viewTimelineName: "--watch-deck",
						viewTimelineInset: "[var(--watch-strip) 0px]",
					},
				},
		},
		playerFrame: {
			position: "relative",
			flexShrink: "0",
			height: "full",
			aspectRatio: "academy-video",
			// Centred while the frame is narrower than the window (the capped
			// tablet player); it docks to the leading edge as it shrinks.
			marginInlineStart: "[max(0px, calc(50% - var(--watch-full) * 8 / 9))]",
			overflow: "hidden",
			backgroundColor: "academyBase.ground",
			"& > *": { position: "absolute", inset: "0" },
			"@media screen and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)":
				{
					"@supports (animation-timeline: view())": {
						animation: "[academy-watch-dock linear both]",
						animationTimeline: "--watch-deck",
						animationRange: "exit 0% exit 100%",
						// The player's own controls cannot work at strip size.
						"& media-video-layout": {
							animation: "[academy-watch-chrome-out linear both]",
							animationTimeline: "--watch-deck",
							animationRange: "exit 0% exit 40%",
						},
					},
				},
			_lg: {
				width: "full",
				marginInlineStart: "0",
				border: "hairline",
				borderColor: "academy.inkBorder",
				borderRadius: "academy-m",
			},
		},
		poster: coverImage,
		noscript: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			gap: "2",
			padding: "6",
			backgroundColor: "academyBase.ground",
			color: "academyBase.text",
			fontSize: "sm",
			textAlign: "center",
			"& p": { margin: "0" },
			"& a": {
				color: "academyBase.text",
				textDecoration: "underline",
				textUnderlineOffset: "2px",
			},
		},
		noscriptLinks: {
			display: "flex",
			flexWrap: "wrap",
			justifyContent: "center",
			gap: "3",
		},
		upcomingThumbnail: {
			position: "absolute",
			inset: "0",
			width: "full",
			height: "full",
			objectFit: "cover",
		},
		// The strip beside the shrunken player: a real play/pause control,
		// then the title and time as a link back to the full player.
		strip: {
			display: "none",
			"@media screen and (max-width: 1023.98px) and (prefers-reduced-motion: no-preference)":
				{
					"@supports (animation-timeline: view())": {
						position: "absolute",
						top: "0",
						insetInlineStart: "[calc(var(--watch-strip) * 16 / 9)]",
						insetInlineEnd: "0",
						display: "flex",
						alignItems: "center",
						gap: "1",
						height: "[var(--watch-strip)]",
						paddingInline: "2",
						color: "academy.inkText",
						animation: "[academy-watch-strip-in linear both]",
						animationTimeline: "--watch-deck",
						animationRange: "exit 60% exit 100%",
					},
				},
			"& [hidden]": { display: "none" },
			// The toggle carries both icons and shows the one for its state.
			"& [data-state=paused] [data-icon=pause], & [data-state=playing] [data-icon=play]":
				{ display: "none" },
		},
		stripLink: {
			display: "flex",
			flex: "1",
			flexDirection: "column",
			justifyContent: "center",
			minWidth: "0",
			minHeight: "11",
			paddingInline: "1",
			color: "academy.inkText",
			textDecoration: "none",
			_focusVisible: focusRingInk,
		},
		stripTitle: {
			overflow: "hidden",
			fontFamily: "academy-display",
			fontSize: "sm",
			fontWeight: "bold",
			lineHeight: "academy-card",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		stripTime: {
			...monoMeta,
			color: "academy.inkTextMuted",
			fontVariantNumeric: "tabular-nums",
		},
		// Breadcrumb, title, date, runtime and kind: the session, once.
		session: {
			position: "relative",
			overflow: "hidden",
			paddingInline: "academy-gutter",
			paddingBlockStart: "5",
			paddingBlockEnd: "8",
			backgroundColor: "academy.ink",
			color: "academy.inkText",
			"& > *": { position: "relative" },
			"@media (max-width: 1023.98px)": {
				...systemGridBottom,
				borderBottom: "hairline",
				borderBottomColor: "academy.inkBorder",
			},
			// The notes' cap, from the same gutter: the share link ends on the
			// ledger's right rule. The title keeps its own measure.
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				"& > :not(h1)": { maxWidth: "[50rem]" },
			},
			_lg: {
				flexShrink: "0",
				overflow: "visible",
				// As wide as the player, so the share link ends on its edge.
				maxWidth: "[var(--watch-player-w)]",
				paddingInline: "0",
				paddingBlockStart: "3",
				paddingBlockEnd: "0",
				backgroundColor: "transparent",
			},
		},
		// The trail (Breadcrumb.astro) and the live status share one line
		// above the title. The trail is set for the canvas, so its colours
		// are restated for ink here.
		breadcrumb: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "baseline",
			justifyContent: "space-between",
			columnGap: "4",
			"& nav a": {
				color: "academy.inkTextMuted",
				...watchFeedback,
				_hover: { color: "academy.inkText" },
				_focusVisible: focusRingInk,
			},
			"& nav [aria-hidden]": { color: "academy.inkTextMuted" },
		},
		breadcrumbStatus: {
			...monoMeta,
			marginInlineStart: "auto",
			color: "academy.inkText",
		},
		title: {
			maxWidth: "[22ch]",
			margin: "0",
			color: "academy.inkText",
			fontFamily: "academy-display",
			fontSize: "3xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "academy-title",
			textWrap: "balance",
			overflowWrap: "break-word",
			// Only a very long word is hyphenated, and only where the limit is
			// honoured: an ordinary title never is.
			"@supports (hyphenate-limit-chars: 14 6 6)": {
				hyphens: "auto",
				hyphenateLimitChars: "[14 6 6]",
			},
			_lg: { fontSize: "[clamp(1.875rem, 0.6rem + 2vw, 2.25rem)]" },
		},
		// Date, runtime and kind on one mono line, separated by a middle dot.
		meta: {
			...monoMeta,
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			columnGap: "3",
			rowGap: "1",
			marginBlockStart: "3",
			color: "academy.inkTextSoft",
			fontVariantNumeric: "tabular-nums",
			"& > * + *::before": {
				// A middle dot, escaped so the generated class name stays ASCII.
				content: '"\\b7"',
				marginInlineEnd: "3",
				color: "academy.inkTextMuted",
				// Where alt text is supported the dot is not spoken.
				'@supports (content: "x" / "")': { content: '"\\b7" / ""' },
			},
		},
		// The kind label (MLabel) is set for the canvas; on ink it reads as
		// one more item of the meta line.
		metaKind: {
			display: "inline-flex",
			alignItems: "center",
			"& > span": {
				color: "inherit",
				fontWeight: "normal",
				letterSpacing: "normal",
				lineHeight: "inherit",
			},
		},
		upcoming: {
			display: "flex",
			flexDirection: "column",
			alignItems: "start",
			gap: "2",
			marginBlockStart: "4",
			paddingBlockStart: "4",
			borderTop: "hairline",
			borderTopColor: "academy.inkBorder",
			"& > :last-child": { marginBlockStart: "2" },
		},
		noticeTitle: {
			margin: "0",
			color: "academy.inkText",
			fontSize: "md",
			fontWeight: "bold",
			lineHeight: "tight",
			textWrap: "balance",
		},
		noticeCopy: {
			maxWidth: "[60ch]",
			margin: "0",
			color: "academy.inkTextSoft",
			fontSize: "sm",
			lineHeight: "body",
			textWrap: "pretty",
			"& time": { color: "academy.inkText", fontWeight: "medium" },
		},
		factLink: {
			color: "academy.inkText",
			fontSize: "sm",
			textDecoration: "underline",
			textUnderlineOffset: "2px",
			...watchFeedback,
			_hover: { color: "academy.inkAccent" },
			_active: { color: "academy.inkAccent" },
			_focusVisible: focusRingInk,
		},
		// Under the meta line: the technologies as pills in the first track,
		// the share link top right in the second, whatever the chip count.
		// Below `sm` the pills take the full width and the link its own row.
		tools: {
			display: "grid",
			gridTemplateColumns: {
				base: "[minmax(0, 1fr)]",
				sm: "[minmax(0, 1fr) auto]",
			},
			alignItems: "start",
			columnGap: "3",
			rowGap: "3",
			marginBlockStart: "4",
		},
		// Composed with `button()`: the doubled selector wins over the
		// button's own size. The width holds "Link copied" so the label swap
		// does not resize it.
		toolsEnd: {
			"&&": {
				gridColumn: { base: "1", sm: "2" },
				justifySelf: { base: "start", sm: "auto" },
				minWidth: "[7rem]",
				whiteSpace: "nowrap",
				"@media (max-width: 1023.98px)": { minHeight: "11" },
			},
		},
		// What to watch next. It follows the notes in the source, closes the
		// page in ink on narrow screens and is placed at the foot of the ink
		// column from `lg` (pinned there when `bench` has the room).
		more: {
			paddingBlock: "10",
			borderTop: "hairline",
			borderTopColor: "academy.inkBorder",
			backgroundColor: "academy.ink",
			color: "academy.inkText",
			_lg: {
				gridColumn: "1 / 3",
				gridRow: "2",
				minWidth: "0",
				paddingBlockStart: "0",
				paddingBlockEnd: "8",
				borderTop: "none",
				borderInlineEnd: "hairline",
				borderInlineEndColor: "academy.inkBorder",
				backgroundColor: { base: "academy.ink", _dark: "academy.inkRaised" },
			},
		},
		moreInner: {
			paddingInline: "academy-gutter",
			_lg: {
				width: "full",
				// As `paneInner`: the 708px track less the pane's own rule.
				maxWidth: "[707px]",
				marginInlineStart: "auto",
				paddingInlineEnd: "10",
				"& > *": {
					// Ends on the player's right edge.
					maxWidth: "[var(--watch-player-w)]",
					paddingBlockStart: "4",
					borderTop: "hairline",
					borderTopColor: "academy.inkBorder",
				},
			},
		},
		extrasBlock: {
			display: "flex",
			flexDirection: "column",
			gap: "3",
			minWidth: "0",
		},
		inkHeader: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "space-between",
			columnGap: "3",
			rowGap: "1",
		},
		inkHeading: {
			margin: "0",
			color: "academy.inkText",
			fontFamily: "academy-display",
			fontSize: "md",
			fontWeight: "bold",
			lineHeight: "tight",
		},
		inkLink: {
			display: "inline-flex",
			alignItems: "center",
			gap: "1",
			minHeight: { base: "11", lg: "auto" },
			color: "academy.inkTextSoft",
			fontSize: "sm",
			fontWeight: "semibold",
			textDecoration: "none",
			whiteSpace: "nowrap",
			"& > span": {
				transitionProperty: "[transform]",
				transitionDuration: "base",
				transitionTimingFunction: "academy-out",
			},
			_hover: {
				color: "academy.inkAccent",
				textDecoration: "underline",
				textUnderlineOffset: "0.2em",
				"& > span": { transform: "translateX(0.2em)" },
			},
			_focusVisible: focusRingInk,
			_motionReduce: { "& > span": { transitionDuration: "none" } },
		},
		techGrid: {
			display: "flex",
			flexWrap: "wrap",
			gap: "2",
			margin: "0",
			padding: "0",
			listStyle: "none",
		},
		techChip: {
			display: "inline-flex",
			alignItems: "center",
			gap: "2",
			minHeight: { base: "11", lg: "9" },
			paddingInlineStart: "2",
			paddingInlineEnd: "3",
			border: "hairline",
			borderColor: "academy.inkBorder",
			borderRadius: "academy-pill",
			color: "academy.inkText",
			fontSize: "sm",
			textDecoration: "none",
			...watchFeedback,
			_hover: { borderColor: "academy.inkAccent", color: "academy.inkAccent" },
			_active: { borderColor: "academy.inkAccent", color: "academy.inkAccent" },
			_focusVisible: focusRingInk,
		},
		// A logo is drawn for paper, so it keeps a paper tile in both schemes.
		techIcon: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "6",
			height: "6",
			padding: "0.5",
			overflow: "hidden",
			borderRadius: "full",
			backgroundColor: "academyBase.text",
			"& img": { width: "full", height: "full", objectFit: "contain" },
		},
		techName: { color: "currentColor" },
		upNextList: {
			display: "grid",
			columnGap: "6",
			margin: "0",
			padding: "0",
			listStyle: "none",
			"& > li": {
				borderTop: "hairline",
				borderTopColor: "academy.inkBorder",
			},
			_sm: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
			// Two columns never orphan a third row.
			"@media (min-width: 640px) and (max-width: 1023.98px)": {
				"& > li:nth-child(n + 3)": { display: "none" },
			},
			_lg: { gridTemplateColumns: "minmax(0, 1fr)" },
		},
		upNextLink: {
			display: "grid",
			gridTemplateColumns: "[5.5rem minmax(0, 1fr)]",
			gap: "3",
			alignItems: "center",
			paddingBlock: "2",
			color: "academy.inkText",
			textDecoration: "none",
			_hover: {
				"& [data-title]": { color: "academy.inkAccent" },
				"& img": { transform: "scale(1.04)" },
			},
			_active: { "& [data-title]": { color: "academy.inkAccent" } },
			_focusVisible: focusRingInk,
		},
		upNextStill: {
			...videoFrame,
			borderRadius: "academy-s",
			backgroundColor: "academy.inkRaised",
		},
		upNextImage: coverImageZoom,
		upNextBody: { display: "grid", minWidth: "0" },
		upNextMeta: {
			...monoMeta,
			color: "academy.inkTextSoft",
			fontVariantNumeric: "tabular-nums",
		},
		upNextTitle: {
			display: "-webkit-box",
			overflow: "hidden",
			margin: "0",
			color: "academy.inkText",
			fontSize: "sm",
			fontWeight: "semibold",
			lineHeight: "academy-card",
			lineClamp: "2",
			boxOrient: "vertical",
			...watchFeedback,
		},
		// The canvas pane: the working notes, in the order you need them.
		notes: {
			minWidth: "0",
			paddingInline: "academy-gutter",
			paddingBlockStart: "8",
			paddingBlockEnd: "16",
			_lg: {
				gridColumn: "3 / 5",
				gridRow: "1 / 3",
				paddingInlineStart: "10",
				paddingBlockStart: "8",
				paddingBlockEnd: "20",
			},
		},
		notesInner: {
			display: "flex",
			flexDirection: "column",
			gap: "12",
			maxWidth: "academy-copy",
			// On the gutter, under the title.
			marginInline: "0",
			// A tablet has room for the ledger: headings in a label track.
			// The about block has no visible heading and spans both tracks.
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				maxWidth: "[50rem]",
				"& > section:first-child": {
					display: "flex",
					"& > *": { maxWidth: "[32rem]" },
				},
			},
			// 472px of track less the pane's own padding and the shell gutter.
			_lg: {
				gap: "14",
				maxWidth: "[384px]",
				// With no lede the description opens the notes: its first line
				// is trimmed like the lede's (child 1 is the sr-only heading).
				"& > section:first-child > [data-academy-prose]:nth-child(2) > :first-child":
					{ marginBlockStart: "[-0.4em]" },
			},
		},
		lede: {
			...ledeText,
			maxWidth: "[none]",
			color: "academy.text",
			fontWeight: "medium",
			lineHeight: "body",
			textWrap: "balance",
			// The leading above the first line is trimmed so its cap line sits
			// on the player's top edge across the seam.
			_lg: { marginBlockStart: "[-0.4em]" },
		},
		// The description is rendered rich text (the `prose` slot of
		// `academyLayout`), stepped down to sit in a notes column.
		description: {
			minWidth: "0",
			"&&": { fontSize: "md", lineHeight: "body" },
			"&& > * + *": { marginTop: "4" },
			"&& :is(p, li)": { textWrap: "pretty" },
			"&& h2": { fontSize: "xl" },
			"&& h3": { fontSize: "lg" },
		},
		section: {
			display: "flex",
			flexDirection: "column",
			gap: "4",
			minWidth: "0",
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				...watchLedger,
			},
		},
		sectionTitle: {
			margin: "0",
			color: "academy.text",
			fontFamily: "academy-display",
			fontSize: "2xl",
			fontWeight: "extrabold",
			letterSpacing: "academy-tight",
			lineHeight: "tight",
			textWrap: "balance",
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				fontSize: "xl",
			},
		},
		// Numbered because the order is real. The numeral is the list marker
		// itself, so the list stays an ordered list for every reader.
		learnList: {
			display: "grid",
			margin: "0",
			// The numeral right-aligns in the 3.25rem label gutter the time
			// codes use, and the text starts on the same 4rem edge. The site's
			// list reset (unlayered, so it wins) already indents this list by
			// 1.5rem; the margin makes up the rest of the gutter.
			marginInlineStart: "[1.75rem]",
			color: "academy.text",
			fontSize: "md",
			lineHeight: "body",
			"& > li": {
				position: "relative",
				paddingBlock: "4",
				paddingInlineStart: "3",
				textWrap: "pretty",
				_before: {
					content: '""',
					position: "absolute",
					top: "0",
					insetInlineStart: "[-3.25rem]",
					insetInlineEnd: "0",
					borderTop: "hairline",
				},
				_marker: {
					content: "counter(list-item)",
					color: "academy.accent",
					fontFamily: "academy-display",
					fontSize: "xl",
					fontWeight: "extrabold",
					fontVariantNumeric: "tabular-nums",
				},
			},
			"& > li:last-child": {
				_after: {
					content: '""',
					position: "absolute",
					bottom: "0",
					insetInlineStart: "[-3.25rem]",
					insetInlineEnd: "0",
					borderTop: "hairline",
				},
			},
		},
		// Resources: a ruled list. The name takes the full measure; the kind
		// (the resource's own category, when it has one) sits beneath it.
		linkList: {
			display: "grid",
			margin: "0",
			padding: "0",
			listStyle: "none",
			borderTop: "hairline",
			"& > li": { borderBottom: "hairline" },
		},
		linkRow: {
			display: "grid",
			gridTemplateColumns: "[minmax(0, 1fr) auto]",
			columnGap: "3",
			alignItems: "baseline",
			minHeight: "11",
			paddingBlock: "3",
			color: "academy.text",
			textDecoration: "none",
			_hover: {
				"& [data-name]": { color: "academy.accent" },
				"& [data-arrow]": {
					color: "academy.accent",
					transform: "translate(2px, -2px)",
				},
			},
			_active: {
				"& [data-name]": { color: "academy.accent" },
				"& [data-arrow]": { color: "academy.accent" },
			},
			_focusVisible: focusRing,
		},
		linkKind: { ...monoMeta, overflowWrap: "anywhere" },
		linkBody: { display: "grid", gap: "1", minWidth: "0" },
		linkName: {
			fontWeight: "semibold",
			lineHeight: "academy-card",
			...watchFeedback,
		},
		linkNote: {
			color: "academy.textMuted",
			fontSize: "sm",
			lineHeight: "body",
		},
		linkArrow: {
			color: "academy.textMuted",
			transitionProperty: "[transform, color]",
			transitionDuration: "fast",
			transitionTimingFunction: "academy-out",
			_motionReduce: { transitionDuration: "none" },
		},
		// The cast in the ledger grammar: ruled rows of portrait, name and
		// handle, role. The portrait sits in the label gutter in greyscale and
		// comes into colour under the pointer or focus, as on People.
		castGrid: {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			gap: "0",
			margin: "0",
			padding: "0",
			listStyle: "none",
			borderTop: "hairline",
			"& > li": { borderBottom: "hairline" },
		},
		castCard: {
			display: "grid",
			gridTemplateColumns: "[3.25rem minmax(0, 1fr) auto]",
			columnGap: "3",
			alignItems: "center",
			minWidth: "0",
			minHeight: "14",
			paddingBlock: "2",
			color: "academy.text",
			textDecoration: "none",
			_hover: {
				"& [data-name]": { color: "academy.accent" },
				"& img": { filter: "[none]" },
			},
			_active: { "& [data-name]": { color: "academy.accent" } },
			_focusVisible: { ...focusRing, "& img": { filter: "[none]" } },
		},
		castAvatar: {
			justifySelf: "start",
			width: "10",
			height: "10",
			marginBlockEnd: "0",
			borderRadius: "full",
			objectFit: "cover",
			filter: "[grayscale(1) contrast(1.05)]",
			transitionProperty: "[filter]",
			transitionDuration: "base",
			transitionTimingFunction: "academy-out",
			"&[hidden]": { display: "none" },
			_motionReduce: { transitionDuration: "none" },
		},
		castInitials: {
			display: "grid",
			placeItems: "center",
			border: "hairline",
			borderColor: "academy.border",
			background: "academy.ground",
			color: "academy.textSoft",
			fontFamily: "academy-text",
			fontSize: "sm",
			fontWeight: "semibold",
			"&[hidden]": { display: "none" },
		},
		castBody: { display: "grid", minWidth: "0" },
		castName: {
			margin: "0",
			color: "currentColor",
			fontSize: "md",
			fontWeight: "semibold",
			lineHeight: "academy-card",
			overflowWrap: "anywhere",
			...watchFeedback,
		},
		castMeta: { ...monoMeta, justifySelf: "end", whiteSpace: "nowrap" },
		// A handle is one word: it takes its own line and never breaks.
		castHandle: {
			...monoMeta,
			maxWidth: "full",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		// The newsletter, full width under both panes and above the footer.
		outro: {
			width: "full",
			maxWidth: "academy-shell",
			marginInline: "auto",
			paddingInline: "academy-gutter",
		},
		chapterList: {
			display: "grid",
			margin: "0",
			padding: "0",
			listStyle: "none",
			borderTop: "hairline",
		},
		// One label gutter for the notes: time codes (and the learn list's
		// numerals) right-align in a 3.25rem track, and every row's text
		// starts 4rem from the column edge.
		chapterLink: {
			display: "grid",
			gridTemplateColumns: "[3.25rem minmax(0, 1fr)]",
			columnGap: "3",
			alignItems: "baseline",
			minHeight: "11",
			paddingBlock: "3",
			borderBottom: "hairline",
			color: "academy.text",
			textDecoration: "none",
			...watchFeedback,
			_hover: { color: "academy.accent" },
			_active: { color: "academy.accent" },
			_focusVisible: focusRing,
			// The chapter being played: weight is the cue, not colour.
			"&[aria-current='true']": {
				"& [data-name]": { fontWeight: "semibold" },
				"& [data-time]": { fontWeight: "bold" },
			},
		},
		chapterTime: {
			justifySelf: "end",
			color: "academy.accent",
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontVariantNumeric: "tabular-nums",
			textAlign: "end",
			whiteSpace: "nowrap",
		},
		chapterName: {
			color: "currentColor",
			fontSize: "md",
			lineHeight: "academy-card",
		},
		transcript: { display: "flex", flexDirection: "column", gap: "3" },
		transcriptNote: {
			margin: "0",
			color: "academy.textMuted",
			fontSize: "sm",
			lineHeight: "body",
		},
		fieldLabel: {
			display: "block",
			marginBlockEnd: "1",
			color: "academy.textSoft",
			fontSize: "sm",
			fontWeight: "medium",
		},
		search: { position: "relative" },
		searchInput: {
			...inputField,
			minHeight: "11",
			paddingInlineStart: "10",
			paddingInlineEnd: "3",
			paddingBlock: "2",
			fontFamily: "academy-text",
			fontSize: "sm",
		},
		searchIcon: {
			position: "absolute",
			insetInlineStart: "3",
			insetBlockStart: "3",
			width: "5",
			height: "5",
			color: "academy.textMuted",
			pointerEvents: "none",
		},
		searchSummary: {
			marginBlockStart: "2",
			color: "academy.textMuted",
			fontSize: "sm",
			_empty: { display: "none" },
		},
		// A whole session's transcript is long: it scrolls inside its own
		// frame so the notes after it stay within reach.
		transcriptContainer: {
			maxHeight: "[min(var(--sizes-academy-transcript), 70svh)]",
			overflowY: "auto",
			borderBlock: "hairline",
			scrollbarWidth: "thin",
			_focusVisible: focusRing,
		},
		transcriptBody: {
			display: "grid",
			"& > section:last-child > p:last-child": { borderBottom: "none" },
		},
		// The link inside is 44px tall with its text centred, so the heading's
		// own margins are what is left of the 20px above and 8px below.
		transcriptChapter: {
			marginBlockStart: "2",
			marginBlockEnd: "0",
			color: "academy.text",
			fontSize: "md",
			fontWeight: "bold",
			lineHeight: "tight",
		},
		transcriptChapterLink: {
			display: "grid",
			gridTemplateColumns: "[3.25rem minmax(0, 1fr)]",
			columnGap: "3",
			alignItems: "baseline",
			alignContent: "center",
			width: "full",
			minHeight: "11",
			color: "academy.text",
			textDecoration: "none",
			...watchFeedback,
			_hover: { color: "academy.accent" },
			_focusVisible: focusRingInset,
		},
		// One line of the transcript: its time code, then the words.
		transcriptParagraph: {
			display: "grid",
			gridTemplateColumns: "[3.25rem minmax(0, 1fr)]",
			columnGap: "3",
			alignItems: "baseline",
			margin: "0",
			paddingBlock: "3",
			borderBottom: "hairline",
			color: "academy.textSoft",
			fontSize: "sm",
			lineHeight: "body",
			textWrap: "pretty",
			"&[hidden]": { display: "none" },
		},
		transcriptTimestamp: {
			justifySelf: "end",
			color: "academy.accent",
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap",
		},
		// The time cell is the row's whole height (a 44px target) without
		// changing it: the padding is taken back by the margin. The ring is
		// inset because the scroll container would clip an outset one.
		transcriptTimestampLink: {
			display: "block",
			alignSelf: "stretch",
			width: "full",
			minHeight: "11",
			paddingBlock: "3",
			marginBlock: "-3",
			// A block, not a flex row: the time then sits on a line with the
			// paragraph's own strut, so both columns share a first baseline.
			lineHeight: "body",
			textAlign: "end",
			textDecoration: "none",
			...watchFeedback,
			_hover: { textDecoration: "underline", textUnderlineOffset: "2px" },
			_focusVisible: focusRingInset,
		},
		transcriptHighlight: {
			paddingInline: "0.5",
			borderRadius: "academy-s",
			backgroundColor: "academy.accent",
			color: "academy.accentForeground",
		},
		player: { width: "full", height: "full", aspectRatio: "academy-video" },
		playerSurface: { position: "relative", width: "full", height: "full" },
		livePlayer: {
			position: "relative",
			width: "full",
			height: "full",
			backgroundColor: "academyBase.ground",
		},
		livePlayerVideo: {
			display: "block",
			width: "full",
			height: "full",
			objectFit: "contain",
			backgroundColor: "academyBase.ground",
		},
		livePlayerStatus: {
			position: "absolute",
			insetInline: "4",
			insetBlockEnd: "4",
			paddingInline: "3",
			paddingBlock: "2",
			borderRadius: "academy-s",
			backgroundColor: "academyBase.ground",
			color: "academyBase.text",
			fontSize: "sm",
			fontWeight: "bold",
		},
		// Reactions and comments: one block at the end of the notes.
		discussion: {
			display: "flex",
			flexDirection: "column",
			gap: "6",
			minWidth: "0",
		},
		// The height is held before the deferred island arrives.
		reactions: {
			minWidth: "0",
			minHeight: "11",
			// In the tablet ledger the row sits in the content track.
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				marginInlineStart: "[16rem]",
			},
		},
		reactionList: {
			position: "relative",
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "2",
		},
		reactionButton: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "2",
			minWidth: "11",
			minHeight: "11",
			paddingInline: "3",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-pill",
			backgroundColor: "transparent",
			color: "academy.text",
			fontFamily: "academy-text",
			fontSize: "sm",
			cursor: "pointer",
			...watchFeedback,
			transitionProperty: "[color, background-color, border-color, transform]",
			_hover: { borderColor: "academy.accent" },
			_active: { transform: "translateY(1px)" },
			_focusVisible: focusRing,
		},
		reactionEmoji: { fontSize: "md", lineHeight: "none" },
		reactionCount: {
			color: "academy.textMuted",
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontVariantNumeric: "tabular-nums",
		},
		reactionPicker: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(2.75rem, 1fr))",
			gap: "1",
			width: "80",
			maxWidth: "[calc(100vw - 2rem)]",
			padding: "3",
			...panelSurface,
			boxShadow: "dialog",
		},
		emojiOption: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			minWidth: "0",
			minHeight: "11",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-s",
			backgroundColor: "academy.ground",
			fontSize: "lg",
			cursor: "pointer",
			...watchFeedback,
			transitionProperty: "[color, background-color, border-color, transform]",
			_hover: {
				borderColor: "academy.accent",
				backgroundColor: "academy.canvas",
			},
			_active: { transform: "translateY(1px)" },
			_focusVisible: focusRing,
		},
		tabsRoot: {
			minWidth: "0",
			maxWidth: "academy-copy",
		},
		resourceGroups: { display: "grid", gap: "6" },
		resourceGroup: { display: "grid", gap: "3" },
		resourceHeading: {
			margin: "0",
			color: "academy.textMuted",
			fontFamily: "academy-mono",
			fontSize: "xs",
			fontWeight: "semibold",
			letterSpacing: "wide",
		},
		resourceList: { display: "grid", gap: "2" },
		resourceLink: {
			display: "grid",
			gridTemplateColumns: "auto minmax(0, 1fr) auto",
			gap: "3",
			alignItems: "start",
			padding: "3",
			border: "hairline",
			borderColor: "academy.border",
			borderRadius: "academy-s",
			backgroundColor: "academy.ground",
			color: "academy.text",
			textDecoration: "none",
			_hover: { borderColor: "academy.accent", color: "academy.accent" },
			_focusVisible: focusRing,
		},
		resourceIcon: {
			width: "5",
			height: "5",
			marginBlockStart: "1",
			color: "academy.textMuted",
		},
		resourceBody: { minWidth: "0" },
		resourceTitle: {
			color: "currentColor",
			fontSize: "sm",
			fontWeight: "semibold",
		},
		resourceDescription: {
			marginBlockStart: "1",
			color: "academy.textMuted",
			fontSize: "xs",
			lineHeight: "body",
		},
		resourceExternal: {
			width: "4",
			height: "4",
			marginBlockStart: "1",
			color: "academy.textMuted",
		},
		comments: {
			display: "flex",
			flexDirection: "column",
			gap: "4",
			minWidth: "0",
			"@media (min-width: 768px) and (max-width: 1023.98px)": {
				...watchLedger,
			},
		},
		commentsTitle: {
			margin: "0",
			color: "academy.text",
			fontFamily: "academy-display",
			fontSize: "xl",
			fontWeight: "bold",
			lineHeight: "tight",
		},
		commentList: { display: "grid", gap: "3" },
		comment: { ...panelSurface, padding: "4" },
		commentRow: { display: "flex", alignItems: "flex-start", gap: "3" },
		commentAvatar: {
			width: "8",
			height: "8",
			borderRadius: "full",
			objectFit: "cover",
			flexShrink: "0",
			border: "hairline",
			borderColor: "academy.border",
		},
		commentAvatarFallback: {
			display: "grid",
			placeItems: "center",
			width: "8",
			height: "8",
			flexShrink: "0",
			borderRadius: "full",
			backgroundColor: "academy.accent",
			color: "academy.accentForeground",
			fontFamily: "academy-display",
			fontSize: "sm",
			fontWeight: "bold",
		},
		commentContent: { minWidth: "0", flex: "1" },
		commentMeta: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "2",
			marginBlockEnd: "1",
		},
		commentAuthor: {
			margin: "0",
			color: "academy.text",
			fontSize: "sm",
			fontWeight: "semibold",
		},
		commentDate: {
			color: "academy.textMuted",
			fontFamily: "academy-mono",
			fontSize: "xs",
		},
		commentBody: {
			color: "academy.textSoft",
			fontSize: "sm",
			lineHeight: "relaxed",
			"& a": { color: "academy.accent", textDecoration: "underline" },
			"& code": {
				paddingInline: "1",
				borderRadius: "academy-s",
				backgroundColor: "academy.ground",
				color: "academy.text",
			},
		},
		commentCta: {
			display: "inline-flex",
			alignItems: "center",
			gap: "1",
			alignSelf: "center",
			color: "academy.accent",
			fontSize: "sm",
			fontWeight: "semibold",
			textDecoration: "none",
			"& svg": { width: "4", height: "4" },
			_hover: { textDecoration: "underline" },
			_focusVisible: focusRing,
		},
		progress: {
			position: "relative",
			display: "grid",
			gap: "1",
			width: "full",
			minWidth: "0",
		},
		progressTrack: {
			height: "1",
			width: "full",
			overflow: "hidden",
			borderRadius: "academy-pill",
			backgroundColor: "academy.segmentOff",
		},
		progressFill: {
			height: "full",
			backgroundColor: "academy.statusSky",
			transitionProperty: "[width]",
			transitionDuration: "fast",
			_motionReduce: { transitionDuration: "none" },
		},
		progressLabel: {
			gridRow: "1",
			justifySelf: "end",
			paddingInline: "2",
			paddingBlock: "1",
			borderRadius: "academy-s",
			backgroundColor: "academy.panel",
			color: "academy.textSoft",
			fontFamily: "academy-mono",
			fontSize: "xs",
			lineHeight: "body",
			fontVariantNumeric: "tabular-nums",
		},
	},
	variants: {
		progressVariant: {
			default: {},
			subtle: { progressFill: { backgroundColor: "academy.textMuted" } },
			accent: { progressFill: { backgroundColor: "academy.accent" } },
		},
		progressHeight: {
			sm: {},
			md: { progressTrack: { height: "1.5" } },
			lg: { progressTrack: { height: "2" } },
		},
		progressOverlay: {
			true: {
				progress: {
					position: "absolute",
					insetBlockEnd: "0",
					insetInline: "0",
					overflow: "hidden",
					borderEndStartRadius: "inherit",
					borderEndEndRadius: "inherit",
				},
				progressTrack: {
					borderRadius: "[0]",
					backgroundColor: "academyBase.border",
				},
				progressLabel: {
					backgroundColor: "academyBase.ground",
					color: "academyBase.text",
				},
			},
			false: {},
		},
		progressComplete: {
			true: { progressFill: { backgroundColor: "academy.statusSpruce" } },
			false: {},
		},
		pressed: {
			true: {
				// No solid fill: `aria-pressed` and the bold count carry the state.
				reactionButton: {
					borderColor: "academy.accent",
					backgroundColor: "academy.ground",
					color: "academy.text",
				},
				reactionCount: { color: "academy.accent", fontWeight: "bold" },
			},
			false: {},
		},
	},
	defaultVariants: {
		pressed: false,
	},
});
