<template>
	<div :class="className" v-bind="$attrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

type Spacing = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const props = withDefaults(
	defineProps<{
		direction?: "vertical" | "horizontal";
		spacing?: Spacing;
		align?: "start" | "center" | "end" | "stretch";
		justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
		wrap?: boolean;
	}>(),
	{
		direction: "vertical",
		spacing: "md",
		align: "stretch",
		justify: "start",
		wrap: false,
	},
);

defineOptions({ inheritAttrs: false });

const gapToken: Record<Spacing, string> = {
	none: "0",
	xs: "1",
	sm: "2",
	md: "4",
	lg: "6",
	xl: "8",
	"2xl": "12",
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

const className = computed(() =>
	css({
		display: "flex",
		flexDirection: props.direction === "horizontal" ? "row" : "column",
		gap: gapToken[props.spacing],
		alignItems: alignMap[props.align],
		justifyContent: justifyMap[props.justify],
		flexWrap: props.wrap ? "wrap" : "nowrap",
	}),
);
</script>
