<template>
	<component :is="as" :class="className" v-bind="$attrs">
		<slot />
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { heading } from "../../../styled-system/recipes";
import type { HeadingVariantProps } from "../../../styled-system/recipes";

const props = withDefaults(
	defineProps<{
		as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
		size?: HeadingVariantProps["size"];
	}>(),
	{ as: "h2", size: "md" },
);

defineOptions({ inheritAttrs: false });

const className = computed(() => heading({ size: props.size }));
</script>
