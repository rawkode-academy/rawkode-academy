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

interface Props {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	href?: string;
	type?: "button" | "submit" | "reset";
	disabled?: boolean;
	fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "primary",
	size: "md",
	type: "button",
	disabled: false,
	fullWidth: false,
});

const tag = computed(() => (props.href ? "a" : "button"));

const baseClasses =
	"inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4";

const variantClasses = {
	primary:
		"text-white bg-blue-700 hover:bg-blue-800 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
	secondary:
		"text-gray-900 bg-white border border-gray-300 hover:bg-gray-100 focus:ring-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700",
	ghost:
		"text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-200 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-gray-700",
	danger:
		"text-white bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-800",
};

const sizeClasses = {
	sm: "text-sm px-3 py-2",
	md: "text-base px-5 py-2.5",
	lg: "text-lg px-6 py-3",
};

const buttonClasses = computed(() => {
	const classes = [
		baseClasses,
		variantClasses[props.variant],
		sizeClasses[props.size],
		props.disabled && "opacity-50 cursor-not-allowed",
		props.fullWidth && "w-full",
	].filter(Boolean);

	return classes.join(" ");
});
</script>