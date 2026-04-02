<template>
	<div :class="stackClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

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

const spacingMap = {
	vertical: { none: "0", xs: "1", sm: "2", md: "4", lg: "6", xl: "8", "2xl": "12" },
	horizontal: { none: "0", xs: "2", sm: "3", md: "4", lg: "6", xl: "8", "2xl": "12" },
};

const alignMap = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	stretch: "stretch",
} as const;

const justifyMap = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	between: "space-between",
	around: "space-around",
	evenly: "space-evenly",
} as const;

const stackClasses = computed(() => {
	return cx(
		css({
			display: "flex",
			flexDirection: props.direction === "vertical" ? "column" : "row",
			gap: spacingMap[props.direction][props.spacing],
			alignItems: alignMap[props.align],
			justifyContent: justifyMap[props.justify],
			...(props.wrap ? { flexWrap: "wrap" } : {}),
		}),
		props.class,
	);
});
</script>
