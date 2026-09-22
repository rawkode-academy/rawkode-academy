import { cva } from "../../styled-system/css";

/** Preserve the public width/padding API; xl is the shared Academy shell. */
export const academyContainer = cva({
	base: {
		width: "full",
		minWidth: "0",
		boxSizing: "border-box",
		marginInline: "auto",
	},
	variants: {
		size: {
			sm: { maxWidth: "2xl" }, // 42rem
			md: { maxWidth: "4xl" }, // 56rem
			lg: { maxWidth: "6xl" }, // 72rem
			xl: { maxWidth: "academy-shell" }, // 1180px, including gutters
			"2xl": { maxWidth: "breakpoint-2xl" }, // 1536px
			full: { maxWidth: "full" },
		},
		padding: {
			none: { paddingInline: "0" },
			sm: { paddingInline: "4" },
			md: { paddingInline: { base: "4", lg: "6" } },
			lg: { paddingInline: "academy-gutter" },
		},
	},
	defaultVariants: { size: "xl", padding: "md" },
});
