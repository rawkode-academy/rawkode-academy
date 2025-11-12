<template>
	<div :class="panelClasses">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

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

const baseClasses = "relative";

const variantClasses = {
	light: "bg-white/30 dark:bg-gray-800/30",
	medium: "bg-white/50 dark:bg-gray-800/50",
	dark: "bg-white/70 dark:bg-gray-800/70",
};

const blurClasses = {
	sm: "backdrop-blur-sm",
	md: "backdrop-blur-md",
	lg: "backdrop-blur-lg",
	xl: "backdrop-blur-xl",
	"2xl": "backdrop-blur-2xl",
};

const paddingClasses = {
	none: "p-0",
	sm: "p-4",
	md: "p-6",
	lg: "p-8",
	xl: "p-10",
};

const roundedClasses = {
	none: "rounded-none",
	sm: "rounded-sm",
	md: "rounded-md",
	lg: "rounded-lg",
	xl: "rounded-xl",
	"2xl": "rounded-2xl",
	"3xl": "rounded-3xl",
};

const borderClass = "border-glass";
const shadowClass = "card-shadow";

const panelClasses = computed(() => {
	return [
		baseClasses,
		variantClasses[props.variant],
		blurClasses[props.blur],
		paddingClasses[props.padding],
		roundedClasses[props.rounded],
		props.border && borderClass,
		props.shadow && shadowClass,
		props.class,
	]
		.filter(Boolean)
		.join(" ");
});
</script>
