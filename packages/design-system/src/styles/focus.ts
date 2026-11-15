import type { SystemStyleObject } from "../../styled-system/types";

/**
 * The Academy focus ring. Compose it under `_focusVisible` so pointer
 * clicks never draw it:
 *
 *   _focusVisible: focusRing
 *
 * Every interactive element uses one of these three; do not hand-write an
 * outline in a recipe.
 */
export const focusRing = {
	outline: "focus",
	outlineColor: "academy.accent",
	outlineOffset: "focus",
} as const satisfies SystemStyleObject;

/** For controls that fill their container, where an outset ring would clip. */
export const focusRingInset = {
	outline: "focus",
	outlineColor: "academy.accent",
	outlineOffset: "focus-inset",
} as const satisfies SystemStyleObject;

/** For controls that sit on an ink surface. */
export const focusRingInk = {
	outline: "focus",
	outlineColor: "academy.inkAccent",
	outlineOffset: "focus",
} as const satisfies SystemStyleObject;
