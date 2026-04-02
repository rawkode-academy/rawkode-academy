<template>
	<div :class="gridClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

interface Props {
	cols?: 1 | 2 | 3 | 4 | 5 | 6 | "auto-fit" | "auto-fill";
	colsMd?: 1 | 2 | 3 | 4 | 5 | 6;
	colsLg?: 1 | 2 | 3 | 4 | 5 | 6;
	gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	cols: 1,
	gap: "md",
});

function repeatCols(n: number) {
	return `repeat(${n}, minmax(0, 1fr))`;
}

const colsMap: Record<string | number, string> = {
	1: repeatCols(1),
	2: repeatCols(2),
	3: repeatCols(3),
	4: repeatCols(4),
	5: repeatCols(5),
	6: repeatCols(6),
	"auto-fit": "repeat(auto-fit, minmax(250px, 1fr))",
	"auto-fill": "repeat(auto-fill, minmax(250px, 1fr))",
};

const gapMap = {
	none: "0",
	xs: "2",
	sm: "3",
	md: "6",
	lg: "8",
	xl: "10",
	"2xl": "12",
};

const gridClasses = computed(() => {
	const styleObj: Record<string, any> = {
		display: "grid",
		gridTemplateColumns: colsMap[props.cols],
		gap: gapMap[props.gap],
	};

	if (props.colsMd) {
		styleObj.md = { gridTemplateColumns: repeatCols(props.colsMd) };
	}
	if (props.colsLg) {
		styleObj.lg = { gridTemplateColumns: repeatCols(props.colsLg) };
	}

	return cx(css(styleObj), props.class);
});
</script>
