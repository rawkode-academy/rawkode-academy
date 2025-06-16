<template>
	<div
		class="flex gap-3 p-4 border-b border-gray-200 dark:border-gray-700"
		role="status"
		:aria-label="ariaLabel"
	>
		<span class="sr-only">{{ ariaLabel }}</span>
		<!-- Avatar skeleton -->
		<div
			class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-full shrink-0"
			:style="{
				width: '2.5rem',
				height: '2.5rem',
			}"
		/>

		<!-- Comment content -->
		<div class="flex-1">
			<!-- Header with author and timestamp -->
			<div class="flex items-center gap-2 mb-2">
				<div
					class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4"
					style="width: 120px"
				/>
				<div
					class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3"
					style="width: 80px"
				/>
			</div>

			<!-- Comment text -->
			<SkeletonText
				:lines="lines"
				:line-height="'0.875rem'"
				:last-line-width="lastLineWidth"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from "./SkeletonText.vue";

interface Props {
	lines?: number;
	lastLineWidth?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	lines: 2,
	lastLineWidth: "70%",
	ariaLabel: "Loading comment...",
});
</script>