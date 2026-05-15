<template>
	<div :class="className" v-bind="$attrs">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { css } from "../../../styled-system/css";

const props = withDefaults(
	defineProps<{
		size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
		padding?: "none" | "sm" | "md" | "lg";
	}>(),
	{ size: "xl", padding: "md" },
);

defineOptions({ inheritAttrs: false });

const sizeMap = {
	sm: "42rem",
	md: "56rem",
	lg: "72rem",
	xl: "80rem",
	"2xl": "96rem",
	full: "100%",
} as const;

const paddingMap = {
	none: { px: "0" },
	sm: { px: "4" },
	md: { px: "4", lg: { px: "6" } },
	lg: { px: "4", lg: { px: "8" } },
} as const;

const className = computed(() =>
	css({
		mx: "auto",
		w: "full",
		maxWidth: sizeMap[props.size],
		...paddingMap[props.padding],
	}),
);
</script>
