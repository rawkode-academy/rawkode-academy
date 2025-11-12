<template>
	<div :class="gridClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

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

const baseClasses = "grid";

const colsClasses = {
	1: "grid-cols-1",
	2: "grid-cols-2",
	3: "grid-cols-3",
	4: "grid-cols-4",
	5: "grid-cols-5",
	6: "grid-cols-6",
	"auto-fit": "grid-cols-[repeat(auto-fit,minmax(250px,1fr))]",
	"auto-fill": "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]",
};

const colsMdClasses = {
	1: "md:grid-cols-1",
	2: "md:grid-cols-2",
	3: "md:grid-cols-3",
	4: "md:grid-cols-4",
	5: "md:grid-cols-5",
	6: "md:grid-cols-6",
};

const colsLgClasses = {
	1: "lg:grid-cols-1",
	2: "lg:grid-cols-2",
	3: "lg:grid-cols-3",
	4: "lg:grid-cols-4",
	5: "lg:grid-cols-5",
	6: "lg:grid-cols-6",
};

const gapClasses = {
	none: "gap-0",
	xs: "gap-2",
	sm: "gap-3",
	md: "gap-6",
	lg: "gap-8",
	xl: "gap-10",
	"2xl": "gap-12",
};

const gridClasses = computed(() => {
	return [
		baseClasses,
		colsClasses[props.cols],
		props.colsMd && colsMdClasses[props.colsMd],
		props.colsLg && colsLgClasses[props.colsLg],
		gapClasses[props.gap],
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
