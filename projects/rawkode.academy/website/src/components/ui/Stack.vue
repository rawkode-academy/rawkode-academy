<template>
	<div :class="stackClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	direction?: "vertical" | "horizontal";
	spacing?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
	align?: "start" | "center" | "end" | "stretch";
	justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
	wrap?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	direction: "vertical",
	spacing: "md",
	align: "stretch",
	justify: "start",
	wrap: false,
});

const baseClasses = "flex";

const directionClasses = {
	vertical: "flex-col",
	horizontal: "flex-row",
};

const spacingClasses = {
	vertical: {
		none: "gap-0",
		xs: "gap-1",
		sm: "gap-2",
		md: "gap-4",
		lg: "gap-6",
		xl: "gap-8",
		"2xl": "gap-12",
	},
	horizontal: {
		none: "gap-0",
		xs: "gap-2",
		sm: "gap-3",
		md: "gap-4",
		lg: "gap-6",
		xl: "gap-8",
		"2xl": "gap-12",
	},
};

const alignClasses = {
	start: "items-start",
	center: "items-center",
	end: "items-end",
	stretch: "items-stretch",
};

const justifyClasses = {
	start: "justify-start",
	center: "justify-center",
	end: "justify-end",
	between: "justify-between",
	around: "justify-around",
	evenly: "justify-evenly",
};

const stackClasses = computed(() => {
	return [
		baseClasses,
		directionClasses[props.direction],
		spacingClasses[props.direction][props.spacing],
		alignClasses[props.align],
		justifyClasses[props.justify],
		props.wrap && "flex-wrap",
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
