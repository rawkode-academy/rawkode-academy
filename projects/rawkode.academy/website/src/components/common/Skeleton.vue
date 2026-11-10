<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			:class="skeleton.line"
			:style="{
				width,
				height,
				borderRadius: rounded ? '9999px' : undefined,
			}"
		/>
	</div>
</template>

<script setup lang="ts">
import { academySkeleton } from "@rawkodeacademy/design-system";

interface Props {
	width?: string;
	height?: string;
	rounded?: boolean;
	className?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	width: "100%",
	height: "1rem",
	rounded: false,
	className: "",
	ariaLabel: "Loading content...",
});
const skeleton = academySkeleton();
</script>
