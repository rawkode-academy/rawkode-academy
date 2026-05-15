<template>
	<div :class="className" v-bind="$attrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

type Blur = "sm" | "md" | "lg" | "xl" | "2xl";
type Padding = "none" | "sm" | "md" | "lg" | "xl";
type Radius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const props = withDefaults(
	defineProps<{
		variant?: "light" | "medium" | "dark";
		blur?: Blur;
		padding?: Padding;
		rounded?: Radius;
		border?: boolean;
		shadow?: boolean;
	}>(),
	{
		variant: "medium",
		blur: "xl",
		padding: "md",
		rounded: "2xl",
		border: true,
		shadow: true,
	},
);

defineOptions({ inheritAttrs: false });

const bgMap = {
	light: "bg.raised/40",
	medium: "bg.raised/60",
	dark: "bg.raised/80",
} as const;

const blurMap: Record<Blur, string> = {
	sm: "4px",
	md: "8px",
	lg: "12px",
	xl: "16px",
	"2xl": "24px",
};

const padMap: Record<Padding, string> = {
	none: "0",
	sm: "4",
	md: "6",
	lg: "8",
	xl: "10",
};

const className = computed(() =>
	css({
		position: "relative",
		bg: bgMap[props.variant],
		backdropFilter: `blur(${blurMap[props.blur]})`,
		WebkitBackdropFilter: `blur(${blurMap[props.blur]})`,
		p: padMap[props.padding],
		borderRadius: props.rounded,
		borderWidth: props.border ? "1px" : "0",
		borderColor: "border.muted",
		boxShadow: props.shadow ? "md" : "none",
	}),
);
</script>
