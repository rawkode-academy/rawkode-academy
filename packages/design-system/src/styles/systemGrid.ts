import type { SystemStyleObject } from "../../styled-system/types";

const lattice = {
	content: '""',
	position: "absolute",
	inset: "0",
	pointerEvents: "none",
	backgroundImage:
		"[linear-gradient(var(--academy-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--academy-grid-line) 1px, transparent 1px)]",
	backgroundSize: "[4rem 4rem]",
} as const satisfies SystemStyleObject;

/**
 * The system grid: the Academy's one decorative motif. A 4rem measurement
 * lattice drawn in the ink hairline colour that fades away from the edge it
 * rises from. It belongs on ink surfaces only (see DESIGN.md).
 *
 * Spread one into a positioned, overflow-hidden slot:
 *
 *   hero: { position: "relative", overflow: "hidden", ...systemGridTop }
 *
 * The slot's children need `position: relative` to sit above the lattice.
 * These are plain object literals on purpose: Panda extracts styles
 * statically and does not follow a function that builds them.
 */
const gridLine =
	"color-mix(in srgb, var(--colors-academy-ink-border) 70%, transparent)";

/** Rises from the top edge: heroes, mastheads, the video stage. */
export const systemGridTop = {
	"--academy-grid-line": gridLine,
	_before: {
		...lattice,
		backgroundPosition: "[center top]",
		maskImage:
			"[radial-gradient(120% 100% at 50% 0%, black 20%, transparent 100%)]",
	},
} as const satisfies SystemStyleObject;

/** Rises from the bottom edge: the footer that closes every page. */
export const systemGridBottom = {
	"--academy-grid-line": gridLine,
	_before: {
		...lattice,
		backgroundPosition: "[center bottom]",
		maskImage:
			"[radial-gradient(120% 100% at 50% 100%, black 20%, transparent 100%)]",
	},
} as const satisfies SystemStyleObject;
