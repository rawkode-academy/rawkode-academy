<template>
	<div
		:class="[
			'animate-pulse',
			{
				'bg-gray-200 dark:bg-gray-700': variant === 'default',
				'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700':
					variant === 'shimmer',
			},
			className,
		]"
		:style="{
			width: width,
			height: height,
			borderRadius: rounded ? borderRadius : undefined,
		}"
		role="status"
		:aria-label="ariaLabel"
	>
		<span class="sr-only">{{ ariaLabel }}</span>
	</div>
</template>

<script setup lang="ts">
interface Props {
	width?: string;
	height?: string;
	rounded?: boolean;
	borderRadius?: string;
	variant?: "default" | "shimmer";
	className?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	width: "100%",
	height: "1rem",
	rounded: true,
	borderRadius: "0.25rem",
	variant: "default",
	className: "",
	ariaLabel: "Loading...",
});
</script>