import type { SystemStyleObject } from "../../styled-system/types";

/**
 * Fragments of the watch workbench (`academyWatch`). Plain object literals:
 * Panda extracts styles statically and does not follow a function.
 */

/**
 * The one feedback transition of the notes and the ink pane: colour only,
 * fast, and off under reduced motion. A slot that also moves on press
 * restates `transitionProperty` with `transform` added.
 */
export const watchFeedback = {
	transitionProperty: "[color, background-color, border-color]",
	transitionDuration: "fast",
	transitionTimingFunction: "academy-out",
	_motionReduce: { transitionDuration: "none" },
} as const satisfies SystemStyleObject;

/**
 * The two-track ledger a notes block takes between `md` and `lg`: its
 * heading in a 14rem label track, everything after it in the content
 * track. Spread it under the range's media query.
 */
export const watchLedger = {
	display: "grid",
	gridTemplateColumns: "[14rem minmax(0, 1fr)]",
	columnGap: "8",
	rowGap: "4",
	alignItems: "start",
	"& > :first-child": { gridColumn: "1" },
	"& > :not(:first-child)": { gridColumn: "2" },
} as const satisfies SystemStyleObject;
