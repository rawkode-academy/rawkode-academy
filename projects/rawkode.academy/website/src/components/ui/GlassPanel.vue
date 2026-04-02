<template>
	<div :class="panelClass">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";
import { paddingValues, roundedValues } from "./tokens";

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

const variantBg: Record<string, Record<string, string>> = {
	light: { base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(31, 41, 55, 0.3)" },
	medium: { base: "rgba(255, 255, 255, 0.5)", _dark: "rgba(31, 41, 55, 0.5)" },
	dark: { base: "rgba(255, 255, 255, 0.7)", _dark: "rgba(31, 41, 55, 0.7)" },
};

const blurValues: Record<string, string> = {
	sm: "4px",
	md: "12px",
	lg: "16px",
	xl: "24px",
	"2xl": "40px",
};

const panelClass = computed(() => {
	const bg = variantBg[props.variant];
	const darkStyles: Record<string, unknown> = {
		backgroundColor: bg._dark,
	};

	if (props.border) {
		darkStyles.borderColor = "rgba(75, 85, 99, 0.5)";
	}
	if (props.shadow) {
		darkStyles.boxShadow = "0 8px 32px 0 rgba(0, 0, 0, 0.6)";
	}

	return cx(
		css({
			position: "relative",
			backgroundColor: bg.base,
			backdropFilter: `blur(${blurValues[props.blur]})`,
			padding: paddingValues[props.padding],
			borderRadius: roundedValues[props.rounded],
			...(props.border && {
				borderWidth: "1px",
				borderStyle: "solid",
				borderColor: "rgba(255, 255, 255, 0.4)",
			}),
			...(props.shadow && {
				boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.12)",
			}),
			_dark: darkStyles,
		}),
		props.class,
	);
});
</script>
