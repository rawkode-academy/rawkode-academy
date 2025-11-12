<template>
	<component
		:is="tag"
		:href="href"
		:class="cardClasses"
		v-bind="$attrs"
	>
		<!-- Badge overlay (top-left) -->
		<div v-if="$slots.badge" class="absolute top-3 left-3 z-20">
			<slot name="badge" />
		</div>

		<!-- Media/Cover slot -->
		<div v-if="$slots.media" class="relative">
			<slot name="media" />
			<!-- Overlay slot (for gradients over media) -->
			<div v-if="$slots.overlay" class="absolute inset-0">
				<slot name="overlay" />
			</div>
		</div>

		<!-- Header slot -->
		<div v-if="$slots.header" :class="headerClasses">
			<slot name="header" />
		</div>

		<!-- Main content -->
		<div :class="contentClasses">
			<slot />
		</div>

		<!-- Footer slot -->
		<div v-if="$slots.footer" :class="footerClasses">
			<slot name="footer" />
		</div>
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	variant?: "glass" | "solid" | "gradient" | "bordered" | "flat";
	padding?: "none" | "sm" | "md" | "lg";
	rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
	shadow?: "none" | "sm" | "md" | "lg" | "elevated";
	hover?: boolean;
	href?: string;
	headerPadding?: "none" | "sm" | "md" | "lg";
	footerPadding?: "none" | "sm" | "md" | "lg";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "glass",
	padding: "md",
	rounded: "xl",
	shadow: "md",
	hover: true,
	headerPadding: "md",
	footerPadding: "md",
});

const tag = computed(() => (props.href ? "a" : "div"));

const baseClasses = "relative overflow-hidden flex flex-col h-full";

const variantClasses = {
	glass: "card-base backdrop-blur-2xl",
	solid:
		"bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
	gradient: "bg-gradient-card border-glass",
	bordered: "bg-transparent border-glass-strong",
	flat: "bg-gray-50 dark:bg-gray-900",
};

const paddingClasses = {
	none: "p-0",
	sm: "p-3",
	md: "p-6",
	lg: "p-8",
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

const shadowClasses = {
	none: "",
	sm: "shadow-sm",
	md: "card-shadow",
	lg: "shadow-lg",
	elevated: "card-shadow-elevated",
};

const cardClasses = computed(() => {
	const classes = [
		baseClasses,
		variantClasses[props.variant],
		roundedClasses[props.rounded],
		shadowClasses[props.shadow],
		props.hover && "card-hover cursor-pointer",
		props.class,
	].filter(Boolean);

	return classes.join(" ");
});

const headerClasses = computed(() => {
	return paddingClasses[props.headerPadding];
});

const contentClasses = computed(() => {
	return [paddingClasses[props.padding], "flex flex-col grow"].join(" ");
});

const footerClasses = computed(() => {
	return [
		paddingClasses[props.footerPadding],
		"mt-auto border-t border-glass-subtle",
	].join(" ");
});
</script>
