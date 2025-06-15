<template>
  <section
    :class="[
      'w-full',
      paddingClass,
      backgroundClass,
      className
    ]"
  >
    <div :class="containerClass">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	padding?: "none" | "sm" | "md" | "lg" | "xl";
	background?: "none" | "gray" | "gradient" | "dots";
	container?: "none" | "sm" | "md" | "lg" | "xl" | "full";
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	padding: "lg",
	background: "none",
	container: "xl",
	class: "",
});

const paddingClass = computed(() => {
	const paddingClasses: Record<string, string> = {
		none: "",
		sm: "py-8 px-4",
		md: "py-12 px-4",
		lg: "py-16 px-4 md:py-20",
		xl: "py-20 px-4 md:py-24 lg:py-32",
	};
	return paddingClasses[props.padding];
});

const backgroundClass = computed(() => {
	const backgroundClasses: Record<string, string> = {
		none: "",
		gray: "bg-gray-50 dark:bg-gray-900",
		gradient:
			"bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800",
		dots: "relative overflow-hidden",
	};
	return backgroundClasses[props.background];
});

const containerClass = computed(() => {
	const containerClasses: Record<string, string> = {
		none: "",
		sm: "max-w-2xl mx-auto",
		md: "max-w-4xl mx-auto",
		lg: "max-w-6xl mx-auto",
		xl: "max-w-7xl mx-auto",
		full: "w-full",
	};
	return containerClasses[props.container];
});

const className = props.class;
</script>