import type { SystemStyleObject } from "../../styled-system/types";
import { systemGridTop } from "./systemGrid";

/**
 * The ink surface that opens a page: the homepage hero, collection
 * mastheads, Search, the not-found page and the video stage. Ink, its own
 * hairline, and the system grid rising from the top edge.
 *
 *   masthead: { ...inkStage, paddingBlock: "academy-hero-tight" },
 *
 * Padding and height stay with the slot: they are what makes a masthead a
 * masthead and a stage a stage.
 */
export const inkSurface = {
	position: "relative",
	overflow: "hidden",
	backgroundColor: "academy.ink",
	color: "academy.inkText",
	borderBottom: "hairline",
	borderColor: "academy.inkBorder",
	...systemGridTop,
} as const satisfies SystemStyleObject;

/**
 * An ink surface whose children all sit above the grid. Use `inkSurface`
 * and write the child rule yourself when one child is absolutely positioned
 * (the homepage's living-system canvas).
 */
export const inkStage = {
	...inkSurface,
	"& > *": { position: "relative" },
} as const satisfies SystemStyleObject;
