<template>
	<span :class="className" v-bind="$attrs">
		<slot />
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { badge } from "../../../styled-system/recipes";
import type { BadgeVariantProps } from "../../../styled-system/recipes";

const props = withDefaults(
	defineProps<{
		variant?: BadgeVariantProps["variant"];
		size?: BadgeVariantProps["size"];
	}>(),
	{ variant: "subtle", size: "md" },
);

defineOptions({ inheritAttrs: false });

const className = computed(() =>
	badge({ variant: props.variant, size: props.size }),
);
</script>
