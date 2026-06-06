<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			class="animate-pulse bg-gray-200 dark:bg-gray-700"
			:class="[rounded ? 'rounded-full' : 'rounded']"
			:style="{ width, height }"
		/>
	</div>
</template>

<script setup lang="ts">
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
</script>
