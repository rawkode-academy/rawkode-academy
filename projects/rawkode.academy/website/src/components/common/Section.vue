<template>
  <section :class="cx(sectionClasses, className)">
    <div :class="containerClasses">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css, cx } from "styled-system/css";

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

const paddingStyles: Record<string, Record<string, any>> = {
	none: {},
	sm: { py: "8", px: "4" },
	md: { py: "12", px: "4" },
	lg: { py: { base: "16", md: "20" }, px: "4" },
	xl: { py: { base: "20", md: "24", lg: "32" }, px: "4" },
};

const backgroundStyles: Record<string, Record<string, any>> = {
	none: {},
	gray: { bg: { base: "gray.50", _dark: "gray.900" } },
	gradient: {
		backgroundImage: {
			base: "linear-gradient(to bottom, var(--colors-gray-50), white)",
			_dark: "linear-gradient(to bottom, var(--colors-gray-900), var(--colors-gray-800))",
		},
	},
	dots: { position: "relative", overflow: "hidden" },
};

const containerStyles: Record<string, Record<string, any>> = {
	none: {},
	sm: { maxWidth: "2xl", mx: "auto" },
	md: { maxWidth: "4xl", mx: "auto" },
	lg: { maxWidth: "6xl", mx: "auto" },
	xl: { maxWidth: "7xl", mx: "auto" },
	full: { width: "full" },
};

const sectionClasses = computed(() =>
	css({
		width: "full",
		...paddingStyles[props.padding],
		...backgroundStyles[props.background],
	}),
);

const containerClasses = computed(() =>
	css(containerStyles[props.container]),
);

const className = props.class;
</script>
