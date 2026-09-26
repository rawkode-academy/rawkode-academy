<template>
	<span :class="[badgeClass, props.class]"><slot /></span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { academyForms } from "@rawkodeacademy/design-system";

interface Props {
	variant?:
		| "default"
		| "primary"
		| "secondary"
		| "success"
		| "warning"
		| "danger"
		| "info";
	size?: "xs" | "sm" | "md" | "lg";
	rounded?: "none" | "sm" | "md" | "lg" | "full";
	outline?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	variant: "default",
	size: "md",
	rounded: "full",
	outline: false,
});


const badgeClass = computed(() => academyForms({
	badgeTone: props.variant,
	badgeSize: props.size,
	badgeRounded: props.rounded,
	outline: props.outline,
}).badge);
</script>
