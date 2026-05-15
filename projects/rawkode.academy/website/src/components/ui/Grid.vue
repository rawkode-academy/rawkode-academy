<template>
	<div :class="className" v-bind="$attrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

type Cols = 1 | 2 | 3 | 4 | 5 | 6 | "auto-fit" | "auto-fill";
type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const props = withDefaults(
	defineProps<{
		cols?: Cols;
		colsMd?: 1 | 2 | 3 | 4 | 5 | 6;
		colsLg?: 1 | 2 | 3 | 4 | 5 | 6;
		gap?: Gap;
		minColWidth?: string;
	}>(),
	{ cols: 1, gap: "md", minColWidth: "250px" },
);

defineOptions({ inheritAttrs: false });

const gapToken: Record<Gap, string> = {
	none: "0",
	xs: "2",
	sm: "3",
	md: "6",
	lg: "8",
	xl: "10",
	"2xl": "12",
};

const colTemplate = (c: Cols, min: string): string => {
	if (c === "auto-fit") return `repeat(auto-fit, minmax(${min}, 1fr))`;
	if (c === "auto-fill") return `repeat(auto-fill, minmax(${min}, 1fr))`;
	return `repeat(${c}, minmax(0, 1fr))`;
};

const className = computed(() => {
	const styles: Record<string, unknown> = {
		display: "grid",
		gridTemplateColumns: colTemplate(props.cols, props.minColWidth),
		gap: gapToken[props.gap],
	};
	if (props.colsMd) {
		styles.md = { gridTemplateColumns: `repeat(${props.colsMd}, minmax(0, 1fr))` };
	}
	if (props.colsLg) {
		styles.lg = { gridTemplateColumns: `repeat(${props.colsLg}, minmax(0, 1fr))` };
	}
	return css(styles);
});
</script>
