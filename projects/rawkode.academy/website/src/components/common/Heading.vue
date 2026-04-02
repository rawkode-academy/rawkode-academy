<template>
  <component :is="tag" :class="headingClasses">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

interface Props {
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
	size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
	align?: "left" | "center" | "right";
	weight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
}

const props = withDefaults(defineProps<Props>(), {
	as: "h2",
	align: "left",
	weight: "bold",
});

const tag = computed(() => props.as);

const defaultSizes = {
	h1: "3xl",
	h2: "2xl",
	h3: "xl",
	h4: "lg",
	h5: "md",
	h6: "sm",
} as const;

const computedSize = computed(() => props.size || defaultSizes[props.as]);

const sizeStyles: Record<string, Record<string, any>> = {
	xs: { fontSize: { base: "sm", md: "base" } },
	sm: { fontSize: { base: "base", md: "lg" } },
	md: { fontSize: { base: "lg", md: "xl" } },
	lg: { fontSize: { base: "xl", md: "2xl" } },
	xl: { fontSize: { base: "2xl", md: "3xl" } },
	"2xl": { fontSize: { base: "2xl", md: "3xl", lg: "4xl" } },
	"3xl": { fontSize: { base: "3xl", md: "4xl", lg: "5xl" } },
	"4xl": { fontSize: { base: "3xl", md: "4xl", lg: "5xl", xl: "6xl" } },
};

const headingClasses = computed(() => {
	return css({
		color: "fg.default",
		letterSpacing: "tight",
		textAlign: props.align,
		fontWeight: props.weight,
		...sizeStyles[computedSize.value],
	});
});
</script>
