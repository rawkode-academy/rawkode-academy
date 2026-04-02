<template>
  <div :class="computedClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { css, cx } from "styled-system/css";

interface Props {
	cols?: {
		default?: number;
		sm?: number;
		md?: number;
		lg?: number;
		xl?: number;
	};
	gap?: number | string;
	align?: "start" | "center" | "end" | "stretch";
	justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	cols: () => ({ default: 1 }),
	gap: 6,
	align: "stretch",
	justify: "start",
});

const justifyMap = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	between: "space-between",
	around: "space-around",
	evenly: "space-evenly",
} as const;

const alignMap = {
	start: "start",
	center: "center",
	end: "end",
	stretch: "stretch",
} as const;

function repeatCols(n: number) {
	return `repeat(${n}, minmax(0, 1fr))`;
}

const gridClasses = computed(() => {
	const colStyles: Record<string, any> = {};

	if (props.cols.default) {
		colStyles.gridTemplateColumns = repeatCols(props.cols.default);
	}
	if (props.cols.sm) {
		colStyles.sm = { gridTemplateColumns: repeatCols(props.cols.sm) };
	}
	if (props.cols.md) {
		colStyles.md = { gridTemplateColumns: repeatCols(props.cols.md) };
	}
	if (props.cols.lg) {
		colStyles.lg = { gridTemplateColumns: repeatCols(props.cols.lg) };
	}
	if (props.cols.xl) {
		colStyles.xl = { gridTemplateColumns: repeatCols(props.cols.xl) };
	}

	const gapValue = typeof props.gap === "number" ? `${props.gap}` : props.gap;

	return css({
		display: "grid",
		gap: gapValue,
		alignItems: alignMap[props.align],
		justifyContent: justifyMap[props.justify],
		...colStyles,
	});
});

const attrs = useAttrs();

const computedClasses = computed(() => {
	return cx(gridClasses.value, props.class || (attrs.class as string));
});
</script>
