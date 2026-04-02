<template>
  <div :class="computedClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";

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

const gridClasses = computed(() => {
	const classes = ["grid"];

	// Column classes
	if (props.cols.default) classes.push(`grid-cols-${props.cols.default}`);
	if (props.cols.sm) classes.push(`sm:grid-cols-${props.cols.sm}`);
	if (props.cols.md) classes.push(`md:grid-cols-${props.cols.md}`);
	if (props.cols.lg) classes.push(`lg:grid-cols-${props.cols.lg}`);
	if (props.cols.xl) classes.push(`xl:grid-cols-${props.cols.xl}`);

	// Gap classes
	if (typeof props.gap === "number") {
		classes.push(`gap-${props.gap}`);
	} else {
		classes.push(props.gap);
	}

	// Alignment classes
	const alignMap = {
		start: "items-start",
		center: "items-center",
		end: "items-end",
		stretch: "items-stretch",
	};
	classes.push(alignMap[props.align]);

	// Justify classes
	const justifyMap = {
		start: "justify-start",
		center: "justify-center",
		end: "justify-end",
		between: "justify-between",
		around: "justify-around",
		evenly: "justify-evenly",
	};
	classes.push(justifyMap[props.justify]);

	return classes.join(" ");
});

const attrs = useAttrs();

const computedClasses = computed(() => {
	return [gridClasses.value, props.class || attrs.class]
		.filter(Boolean)
		.join(" ");
});
</script>