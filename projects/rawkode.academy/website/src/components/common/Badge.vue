<template>
  <span :class="computedClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { css, cx } from "../../../styled-system/css";

interface Props {
	variant?:
		| "default"
		| "primary"
		| "secondary"
		| "tertiary"
		| "success"
		| "warning"
		| "danger"
		| "info";
	size?: "xs" | "sm" | "md" | "lg";
	rounded?: "none" | "sm" | "md" | "lg" | "full";
	outline?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "default",
	size: "md",
	rounded: "full",
	outline: false,
});

const sizeMap = {
	xs: { px: "2", py: "0.5", fontSize: "xs" },
	sm: { px: "2.5", py: "0.5", fontSize: "sm" },
	md: { px: "3", py: "1", fontSize: "sm" },
	lg: { px: "4", py: "1.5", fontSize: "base" },
} as const;

// Shared brand variant used by primary, secondary, tertiary, and info
const brandOutline = {
	border: "1px solid",
	borderColor: { base: "colorPalette.default/50", _dark: "colorPalette.default/50" },
	color: { base: "colorPalette.default", _dark: "white" },
	bg: { base: "rgba(255, 255, 255, 0.3)", _dark: "colorPalette.default/40" },
};

const brandSolid = {
	bg: { base: "colorPalette.default/20", _dark: "colorPalette.default/40" },
	color: { base: "colorPalette.default", _dark: "white" },
	border: "1px solid",
	borderColor: { base: "colorPalette.default/30", _dark: "colorPalette.default/50" },
};

function colorVariant(
	outline: boolean,
	outlineBorder: Record<string, any>,
	outlineColor: Record<string, any>,
	outlineBg: Record<string, any>,
	solidBg: Record<string, any>,
	solidColor: Record<string, any>,
	solidBorder: Record<string, any>,
): Record<string, any> {
	return outline
		? { border: "1px solid", borderColor: outlineBorder, color: outlineColor, bg: outlineBg }
		: { bg: solidBg, color: solidColor, border: "1px solid", borderColor: solidBorder };
}

const variantStyles = computed(() => {
	const o = props.outline;

	const styles: Record<string, Record<string, any>> = {
		default: colorVariant(
			o,
			{ base: "rgba(209, 213, 219, 0.5)", _dark: "rgba(107, 114, 128, 0.6)" },
			{ base: "gray.700", _dark: "gray.100" },
			{ base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(55, 65, 81, 0.4)" },
			{ base: "rgba(107, 114, 128, 0.2)", _dark: "rgba(75, 85, 99, 0.4)" },
			{ base: "gray.800", _dark: "gray.100" },
			{ base: "rgba(156, 163, 175, 0.3)", _dark: "rgba(107, 114, 128, 0.5)" },
		),
		primary: o ? brandOutline : brandSolid,
		secondary: o ? brandOutline : brandSolid,
		tertiary: o ? brandOutline : brandSolid,
		success: colorVariant(
			o,
			{ base: "rgba(22, 163, 74, 0.5)", _dark: "rgba(74, 222, 128, 0.6)" },
			{ base: "green.600", _dark: "green.300" },
			{ base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(21, 128, 61, 0.4)" },
			{ base: "rgba(34, 197, 94, 0.2)", _dark: "rgba(22, 163, 74, 0.4)" },
			{ base: "green.700", _dark: "green.200" },
			{ base: "rgba(34, 197, 94, 0.3)", _dark: "rgba(34, 197, 94, 0.5)" },
		),
		warning: colorVariant(
			o,
			{ base: "rgba(202, 138, 4, 0.5)", _dark: "rgba(250, 204, 21, 0.6)" },
			{ base: "yellow.600", _dark: "yellow.300" },
			{ base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(161, 98, 7, 0.4)" },
			{ base: "rgba(234, 179, 8, 0.2)", _dark: "rgba(202, 138, 4, 0.4)" },
			{ base: "yellow.700", _dark: "yellow.200" },
			{ base: "rgba(234, 179, 8, 0.3)", _dark: "rgba(234, 179, 8, 0.5)" },
		),
		danger: colorVariant(
			o,
			{ base: "rgba(220, 38, 38, 0.5)", _dark: "rgba(248, 113, 113, 0.6)" },
			{ base: "red.600", _dark: "red.300" },
			{ base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(185, 28, 28, 0.4)" },
			{ base: "rgba(239, 68, 68, 0.2)", _dark: "rgba(220, 38, 38, 0.4)" },
			{ base: "red.700", _dark: "red.200" },
			{ base: "rgba(239, 68, 68, 0.3)", _dark: "rgba(239, 68, 68, 0.5)" },
		),
		info: o
			? {
					border: "1px solid",
					borderColor: { base: "colorPalette.default/50", _dark: "colorPalette.default/60" },
					color: "colorPalette.default",
					bg: { base: "rgba(255, 255, 255, 0.3)", _dark: "colorPalette.default/20" },
				}
			: {
					bg: "colorPalette.default/20",
					color: "colorPalette.default",
					border: "1px solid",
					borderColor: { base: "colorPalette.default/30", _dark: "colorPalette.default/50" },
				},
	};

	return styles[props.variant] || styles.default;
});

const attrs = useAttrs();

const computedClasses = computed(() => {
	const size = sizeMap[props.size];
	const baseClass = css({
		display: "inline-flex",
		alignItems: "center",
		fontWeight: "semibold",
		transition: "all",
		transitionDuration: "200ms",
		backdropFilter: "blur(12px)",
		shadow: "sm",
		borderRadius: props.rounded,
		px: size.px,
		py: size.py,
		fontSize: size.fontSize,
		...variantStyles.value,
	});

	return cx(baseClass, props.class || (attrs.class as string));
});
</script>
