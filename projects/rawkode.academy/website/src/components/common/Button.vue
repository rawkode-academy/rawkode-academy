<template>
  <component
    :is="tag"
    :href="href"
    :type="!href ? type : undefined"
    :disabled="!href ? disabled : undefined"
    :class="buttonClasses"
    v-bind="$attrs"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "../../../styled-system/css";

interface Props {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	href?: string;
	type?: "button" | "submit" | "reset";
	disabled?: boolean;
	fullWidth?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "primary",
	size: "md",
	type: "button",
	disabled: false,
	fullWidth: false,
});

const tag = computed(() => (props.href ? "a" : "button"));

const variantStyles = {
	primary: {
		color: "white",
		backgroundImage: "linear-gradient(135deg, rgb(var(--brand-primary)) 0%, rgb(var(--brand-secondary)) 100%)",
		_hover: { filter: "brightness(1.1)" },
		_focus: { ringWidth: "4px", ringColor: "colorPalette.default/50" },
		border: "1px solid",
		borderColor: { base: "colorPalette.default/30", _dark: "colorPalette.default/50" },
	},
	secondary: {
		color: { base: "gray.900", _dark: "white" },
		bg: { base: "rgba(255, 255, 255, 0.5)", _dark: "rgba(55, 65, 81, 0.6)" },
		backdropFilter: "blur(16px)",
		border: "1px solid",
		borderColor: { base: "rgba(255, 255, 255, 0.5)", _dark: "rgba(107, 114, 128, 0.6)" },
		_hover: {
			bg: { base: "rgba(255, 255, 255, 0.7)", _dark: "rgba(75, 85, 99, 0.7)" },
		},
		_focus: {
			ringWidth: "4px",
			ringColor: { base: "rgba(229, 231, 235, 0.5)", _dark: "rgba(107, 114, 128, 0.5)" },
		},
	},
	ghost: {
		color: { base: "gray.700", _dark: "gray.200" },
		border: "1px solid transparent",
		_hover: {
			color: { base: "gray.900", _dark: "white" },
			bg: { base: "rgba(255, 255, 255, 0.6)", _dark: "rgba(75, 85, 99, 0.6)" },
			borderColor: { base: "rgba(255, 255, 255, 0.3)", _dark: "rgba(107, 114, 128, 0.4)" },
		},
		_focus: {
			ringWidth: "4px",
			ringColor: { base: "rgba(229, 231, 235, 0.5)", _dark: "rgba(75, 85, 99, 0.5)" },
		},
	},
	danger: {
		color: "white",
		backgroundImage: {
			base: "linear-gradient(to right, rgba(220, 38, 38, 0.9), rgba(185, 28, 28, 0.9))",
			_dark: "linear-gradient(to right, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))",
		},
		border: "1px solid",
		borderColor: { base: "rgba(239, 68, 68, 0.3)", _dark: "rgba(248, 113, 113, 0.5)" },
		_hover: {
			backgroundImage: {
				base: "linear-gradient(to right, rgba(185, 28, 28, 0.95), rgba(153, 27, 27, 0.95))",
				_dark: "linear-gradient(to right, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))",
			},
		},
		_focus: {
			ringWidth: "4px",
			ringColor: { base: "rgba(252, 165, 165, 0.5)", _dark: "rgba(248, 113, 113, 0.5)" },
		},
	},
} as const;

const sizeStyles = {
	sm: { fontSize: "sm", px: "3", py: "2" },
	md: { fontSize: "base", px: "5", py: "2.5" },
	lg: { fontSize: "lg", px: "6", py: "3" },
} as const;

const buttonClasses = computed(() => {
	const base = css({
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		fontWeight: "medium",
		borderRadius: "xl",
		transition: "all",
		transitionDuration: "200ms",
		outline: "none",
		backdropFilter: "blur(12px)",
		shadow: "md",
		_hover: {
			shadow: "lg",
			transform: "scale(1.05)",
		},
		...sizeStyles[props.size],
		...variantStyles[props.variant],
		...(props.disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
		...(props.fullWidth ? { width: "full" } : {}),
	});

	return cx(base, props.class);
});
</script>
