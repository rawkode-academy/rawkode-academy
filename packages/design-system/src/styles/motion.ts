import type { SystemStyleObject } from "../../styled-system/types";

/**
 * Scroll-driven reveal for a row or card: it rises into place as it enters
 * the viewport. Spread it into the slot of each item in a list.
 *
 * The item is fully visible by default. The reveal only applies on a screen,
 * for a reader who has not asked for reduced motion, in a browser with scroll
 * timelines, so print, reader modes and older browsers always show the
 * content.
 */
export const scrollReveal = {
	"@media screen and (prefers-reduced-motion: no-preference)": {
		"@supports (animation-timeline: view())": {
			animation: "academy-reveal",
			animationTimeline: "view()",
			animationRange: "entry 0% entry 35%",
		},
	},
} as const satisfies SystemStyleObject;
