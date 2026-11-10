import type { SystemStyleObject } from "../../styled-system/types";
import { focusRing } from "./focus";

/**
 * Framed surfaces. A card earns a frame when it is an independent linked
 * item or holds an interactive task (see DESIGN.md); these are that frame.
 *
 *   sidebar: { ...panelSurface, padding: "6" },
 *   card: { ...linkedPanel, display: "flex", flexDirection: "column" },
 *
 * The `hairline` border token already carries `academy.border`, so the
 * fragments set no border colour.
 */

/** A static panel: hairline, the medium radius, the panel fill. */
export const panelSurface = {
	border: "hairline",
	borderRadius: "academy-m",
	backgroundColor: "academy.panel",
} as const satisfies SystemStyleObject;

/**
 * A panel that is a link. Its border takes the accent on hover.
 *
 * A slot that declares its own `_hover` replaces this one (a spread is
 * shallow), so it must restate `borderColor: "academy.accent"`.
 */
export const linkedPanel = {
	...panelSurface,
	color: "academy.text",
	textDecoration: "none",
	transitionProperty: "colors",
	transitionDuration: "fast",
	_hover: { borderColor: "academy.accent" },
	_focusVisible: focusRing,
	_motionReduce: { transitionDuration: "none" },
} as const satisfies SystemStyleObject;

/**
 * The outline of a tag. The slot sets its colour and fill. Tags, chips and
 * filter links are the one fully round surface (see DESIGN.md).
 */
export const pill = {
	display: "inline-flex",
	alignItems: "center",
	paddingInline: "3",
	paddingBlock: "1",
	border: "hairline",
	borderRadius: "academy-pill",
	fontSize: "xs",
} as const satisfies SystemStyleObject;
