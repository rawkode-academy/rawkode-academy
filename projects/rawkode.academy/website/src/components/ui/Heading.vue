<template>
	<component :is="as" :class="className" v-bind="$attrs">
		<slot />
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const props = withDefaults(
	defineProps<{
		as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
		size?: Size;
	}>(),
	{ as: "h2", size: "md" },
);

defineOptions({ inheritAttrs: false });

const sizeMap: Record<Size, string> = {
	xs: "sm",
	sm: "md",
	md: "lg",
	lg: "xl",
	xl: "2xl",
	"2xl": "3xl",
	"3xl": "4xl",
	"4xl": "5xl",
	"5xl": "6xl",
};

const className = computed(() =>
	css({
		fontFamily: "display",
		fontWeight: "bold",
		letterSpacing: "tight",
		lineHeight: "1.2",
		color: "fg.primary",
		fontSize: sizeMap[props.size],
	}),
);
</script>
