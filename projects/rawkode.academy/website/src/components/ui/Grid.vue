<template>
	<div :class="gridClass">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";

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

const gapValues: Record<string, string> = {
	none: "0",
	xs: "0.5rem",
	sm: "0.75rem",
	md: "1.5rem",
	lg: "2rem",
	xl: "2.5rem",
	"2xl": "3rem",
};

function colsToTemplate(cols: number | string): string {
	if (cols === "auto-fit") return "repeat(auto-fit, minmax(250px, 1fr))";
	if (cols === "auto-fill") return "repeat(auto-fill, minmax(250px, 1fr))";
	return `repeat(${cols}, minmax(0, 1fr))`;
}

const gridClass = computed(() => {
	const styles: Record<string, unknown> = {
		display: "grid",
		gridTemplateColumns: colsToTemplate(props.cols),
		gap: gapValues[props.gap],
	};

	if (props.colsMd) {
		styles.md = { gridTemplateColumns: colsToTemplate(props.colsMd) };
	}

	if (props.colsLg) {
		styles.lg = { gridTemplateColumns: colsToTemplate(props.colsLg) };
	}

	return cx(css(styles), props.class);
});
</script>
