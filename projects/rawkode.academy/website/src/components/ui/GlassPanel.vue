<template>
	<div :class="panelClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

interface Props {
	variant?: "light" | "medium" | "dark";
	blur?: "sm" | "md" | "lg" | "xl" | "2xl";
	padding?: "none" | "sm" | "md" | "lg" | "xl";
	rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
	border?: boolean;
	shadow?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "medium",
	blur: "xl",
	padding: "md",
	rounded: "2xl",
	border: true,
	shadow: true,
});

const variantStyles = {
	light: css({ bg: { base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(31, 41, 55, 0.3)" } }),
	medium: css({ bg: { base: "rgba(255, 255, 255, 0.5)", _dark: "rgba(31, 41, 55, 0.5)" } }),
	dark: css({ bg: { base: "rgba(255, 255, 255, 0.7)", _dark: "rgba(31, 41, 55, 0.7)" } }),
};

const blurStyles = {
	sm: css({ backdropFilter: "blur(4px)" }),
	md: css({ backdropFilter: "blur(12px)" }),
	lg: css({ backdropFilter: "blur(16px)" }),
	xl: css({ backdropFilter: "blur(24px)" }),
	"2xl": css({ backdropFilter: "blur(40px)" }),
};

const paddingStyles = {
	none: css({ p: "0" }),
	sm: css({ p: "4" }),
	md: css({ p: "6" }),
	lg: css({ p: "8" }),
	xl: css({ p: "10" }),
};

const roundedStyles = {
	none: css({ borderRadius: "none" }),
	sm: css({ borderRadius: "sm" }),
	md: css({ borderRadius: "md" }),
	lg: css({ borderRadius: "lg" }),
	xl: css({ borderRadius: "xl" }),
	"2xl": css({ borderRadius: "2xl" }),
	"3xl": css({ borderRadius: "3xl" }),
};

const panelClasses = computed(() => {
	return cx(
		css({ position: "relative" }),
		variantStyles[props.variant],
		blurStyles[props.blur],
		paddingStyles[props.padding],
		roundedStyles[props.rounded],
		props.border ? css({ border: "1px solid", borderColor: "var(--surface-border)" }) : undefined,
		props.shadow ? css({ boxShadow: "var(--surface-shadow)" }) : undefined,
		props.class,
	);
});
</script>
