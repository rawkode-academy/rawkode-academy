import type { SystemStyleObject } from "../../styled-system/types";

/**
 * Type fragments: the steps of the Academy type scale that more than one
 * surface sets. Spread one into a slot, then add what is local to it
 * (colour, an entrance animation, a wide-screen size step).
 *
 *   title: { ...mastheadTitle, animation: "academy-rise" },
 *
 * A spread is shallow. A slot that declares its own `_lg` or `_hover` after
 * spreading a fragment that has one replaces the fragment's whole block, so
 * these fragments carry no conditions.
 */

/** Poster-scale display type with no size or colour: the title is the composition. */
export const posterTitle = {
	margin: "0",
	fontFamily: "academy-display",
	fontWeight: "extrabold",
	letterSpacing: "academy-poster",
	lineHeight: "academy-poster",
	textWrap: "balance",
	overflowWrap: "anywhere",
} as const satisfies SystemStyleObject;

/** The title of an ink masthead: collections, Search, the not-found page. */
export const mastheadTitle = {
	...posterTitle,
	color: "academy.inkText",
	fontSize: "academy-masthead",
} as const satisfies SystemStyleObject;

/** The sentence under a poster or section title. The slot sets its colour. */
export const ledeText = {
	margin: "0",
	maxWidth: "academy-lede",
	fontSize: "academy-lede",
	lineHeight: "academy-reading",
	textWrap: "pretty",
} as const satisfies SystemStyleObject;

/** A section title at `academy-section` scale. */
export const sectionTitle = {
	margin: "0",
	fontFamily: "academy-display",
	fontSize: "academy-section",
	fontWeight: "bold",
	letterSpacing: "academy-display",
	lineHeight: "academy-title",
	textWrap: "balance",
} as const satisfies SystemStyleObject;

/** A sub-section heading inside a page: 2xl display. */
export const headingLg = {
	margin: "0",
	fontFamily: "academy-display",
	fontSize: "2xl",
	fontWeight: "bold",
	lineHeight: "tight",
} as const satisfies SystemStyleObject;

/** A panel, rail or card-group heading: xl display. */
export const headingMd = {
	margin: "0",
	fontFamily: "academy-display",
	fontSize: "xl",
	fontWeight: "bold",
	lineHeight: "tight",
} as const satisfies SystemStyleObject;

/**
 * The title of a card in a grid. It carries the colour transition; the
 * linked card sets the hover colour: `_hover: { "& h3": { color: ... } }`.
 */
export const cardTitle = {
	margin: "0",
	fontFamily: "academy-display",
	fontSize: "lg",
	fontWeight: "bold",
	lineHeight: "academy-card",
	letterSpacing: "academy-tight",
	textWrap: "pretty",
	transitionProperty: "colors",
	transitionDuration: "base",
} as const satisfies SystemStyleObject;

/**
 * Sentence-case mono metadata: a date, a runtime, a content kind. The slot
 * adds its own layout (flex, gap, wrap).
 */
export const monoMeta = {
	margin: "0",
	color: "academy.textMuted",
	fontFamily: "academy-mono",
	fontSize: "xs",
	lineHeight: "body",
} as const satisfies SystemStyleObject;

/** The accent mono label above a title. Sentence case, never uppercase. */
export const kicker = {
	margin: "0",
	color: "academy.accent",
	fontFamily: "academy-mono",
	fontSize: "xs",
	fontWeight: "semibold",
	letterSpacing: "wide",
} as const satisfies SystemStyleObject;
