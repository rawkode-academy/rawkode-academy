<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-if="showImage"
			class="mb-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
			:style="{ height: imageHeight }"
		/>
		<SkeletonText :lines="1" line-height="1.25rem" last-line-width="70%" />
		<SkeletonText
			v-if="showDescription"
			class-name="mt-3"
			:lines="descriptionLines"
			line-height="0.875rem"
			last-line-width="60%"
		/>
		<div v-if="showFooter" class="mt-4 flex items-center gap-3">
			<div
				class="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
			/>
			<SkeletonText
				class-name="flex-1"
				:lines="1"
				line-height="0.75rem"
				last-line-width="45%"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from "./SkeletonText.vue";

interface Props {
	showImage?: boolean;
	showDescription?: boolean;
	showFooter?: boolean;
	descriptionLines?: number;
	imageHeight?: string;
	className?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	showImage: true,
	showDescription: true,
	showFooter: false,
	descriptionLines: 2,
	imageHeight: "10rem",
	className: "",
	ariaLabel: "Loading card...",
});
</script>
