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
	"inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 backdrop-blur-md shadow-md hover:shadow-lg hover:scale-105";

const variantClasses = {
	primary:
		"text-white bg-gradient-primary hover:brightness-110 focus:ring-primary/50 border border-primary/30 dark:bg-gradient-primary dark:border-primary/50",
	secondary:
		"text-gray-900 bg-white/50 dark:bg-gray-700/60 backdrop-blur-lg border border-white/50 dark:border-gray-500/60 hover:bg-white/70 dark:hover:bg-gray-600/70 focus:ring-gray-200/50 dark:text-white dark:focus:ring-gray-500/50",
	ghost:
		"text-gray-700 hover:text-gray-900 hover:bg-white/60 dark:hover:bg-gray-600/60 focus:ring-gray-200/50 dark:text-gray-200 dark:hover:text-white dark:focus:ring-gray-600/50 border border-transparent hover:border-white/30 dark:hover:border-gray-500/40",
	danger:
		"text-white bg-gradient-to-r from-red-600/90 to-red-700/90 hover:from-red-700/95 hover:to-red-800/95 focus:ring-red-300/50 border border-red-500/30 dark:from-red-500/90 dark:to-red-600/90 dark:hover:from-red-600/95 dark:hover:to-red-700/95 dark:focus:ring-red-400/50 dark:border-red-400/50",
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
