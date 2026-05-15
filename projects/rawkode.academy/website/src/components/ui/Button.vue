<template>
	<component
		:is="as"
		:type="resolvedType"
		:class="className"
		v-bind="$attrs"
	>
		<slot />
	</component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { button } from "../../../styled-system/recipes";
import type { ButtonVariantProps } from "../../../styled-system/recipes";

const props = withDefaults(
	defineProps<{
		variant?: ButtonVariantProps["variant"];
		size?: ButtonVariantProps["size"];
		as?: "button" | "a";
		type?: "button" | "submit" | "reset";
	}>(),
	{ variant: "solid", size: "md", as: "button" },
);

defineOptions({ inheritAttrs: false });

const className = computed(() =>
	button({ variant: props.variant, size: props.size }),
);

const resolvedType = computed(() =>
	props.as === "button" ? (props.type ?? "button") : undefined,
);
</script>
