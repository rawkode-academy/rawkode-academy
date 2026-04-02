<template>
	<div :class="stackClass">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";

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

const spacingValues: Record<string, Record<string, string>> = {
	vertical: {
		none: "0",
		xs: "0.25rem",
		sm: "0.5rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2rem",
		"2xl": "3rem",
	},
	horizontal: {
		none: "0",
		xs: "0.5rem",
		sm: "0.75rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2rem",
		"2xl": "3rem",
	},
};

const alignMap: Record<string, string> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	stretch: "stretch",
};

const justifyMap: Record<string, string> = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	between: "space-between",
	around: "space-around",
	evenly: "space-evenly",
};

const stackClass = computed(() => {
	const base = css({
		display: "flex",
		flexDirection: props.direction === "vertical" ? "column" : "row",
		gap: spacingValues[props.direction][props.spacing],
		alignItems: alignMap[props.align],
		justifyContent: justifyMap[props.justify],
		flexWrap: props.wrap ? "wrap" : "nowrap",
	});

	return cx(base, props.class);
});
</script>
