import type { SystemStyleObject } from "../../styled-system/types";

/**
 * List styling for rendered rich text. Spread it into a prose slot.
 *
 * The slot's class sits under :where(), so these rules carry no class
 * specificity: plain and nested lists in the text are styled, while a
 * component embedded in the prose (a timeline, a tree) keeps whatever its own
 * classes set on its lists.
 *
 * Panda's selector type only admits a key that starts or ends with "&", so
 * the fragment is checked per rule rather than as one style object.
 */
export const proseLists = {
	":where(&) ul, :where(&) ol": {
		display: "grid",
		gap: "3",
		margin: "0",
		paddingInlineStart: "6",
	},
	":where(&) ul": { listStyle: "disc" },
	":where(&) ol": { listStyle: "decimal" },
	":where(&) li": { paddingInlineStart: "1" },
	":where(&) li::marker": {
		color: "academy.accent",
		fontFamily: "academy-mono",
		fontWeight: "bold",
	},
} as const satisfies Record<string, SystemStyleObject>;
