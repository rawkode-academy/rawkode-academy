<template>
	<div :class="['ui-grid', props.class]" :style="gridStyle">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Columns = 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
	cols?: Columns | "auto-fit" | "auto-fill";
	colsMd?: Columns;
	colsLg?: Columns;
	gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	cols: 1,
	gap: "md",
});

const gaps = {
	none: "var(--spacing-0)",
	xs: "var(--spacing-2)",
	sm: "var(--spacing-3)",
	md: "var(--spacing-6)",
	lg: "var(--spacing-8)",
	xl: "var(--spacing-10)",
	"2xl": "var(--spacing-12)",
};

const columns = (count: Columns) => `repeat(${count}, minmax(0, 1fr))`;

const template = (cols: NonNullable<Props["cols"]>) =>
	typeof cols === "number"
		? columns(cols)
		: `repeat(${cols}, minmax(250px, 1fr))`;

// The breakpoint columns are custom properties so the scoped stylesheet
// can fall back from lg to md to the base count without a class per count.
const gridStyle = computed(() => ({
	"--ui-grid-cols": template(props.cols),
	"--ui-grid-cols-md": props.colsMd ? columns(props.colsMd) : undefined,
	"--ui-grid-cols-lg": props.colsLg ? columns(props.colsLg) : undefined,
	"--ui-grid-gap": gaps[props.gap],
}));
</script>

<style scoped>
.ui-grid {
	display: grid;
	grid-template-columns: var(--ui-grid-cols);
	gap: var(--ui-grid-gap);
}

@media (min-width: 48rem) {
	.ui-grid {
		grid-template-columns: var(--ui-grid-cols-md, var(--ui-grid-cols));
	}
}

@media (min-width: 64rem) {
	.ui-grid {
		grid-template-columns: var(
			--ui-grid-cols-lg,
			var(--ui-grid-cols-md, var(--ui-grid-cols))
		);
	}
}
</style>
