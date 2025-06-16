<template>
	<div
		:class="[
			'rounded-lg border border-gray-200 dark:border-gray-700 p-4',
			className,
		]"
		role="status"
		:aria-label="ariaLabel"
	>
		<span class="sr-only">{{ ariaLabel }}</span>
		<!-- Image skeleton -->
		<div
			v-if="showImage"
			class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"
			:style="{
				height: imageHeight,
				width: '100%',
			}"
		/>

		<!-- Title skeleton -->
		<div
			v-if="showTitle"
			class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 mb-3"
			:style="{ width: titleWidth }"
		/>

		<!-- Description skeleton -->
		<SkeletonText
			v-if="showDescription"
			:lines="descriptionLines"
			:line-height="'0.875rem'"
			:last-line-width="'75%'"
			class="mb-4"
		/>

		<!-- Footer skeleton -->
		<div v-if="showFooter" class="flex items-center gap-3">
			<!-- Avatar -->
			<div
				v-if="showAvatar"
				class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-full"
				:style="{
					width: '2rem',
					height: '2rem',
				}"
			/>
			<!-- Footer text -->
			<div class="flex-1">
				<div
					class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3"
					:style="{ width: '40%' }"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import SkeletonText from "./SkeletonText.vue";

interface Props {
	showImage?: boolean;
	imageHeight?: string;
	showTitle?: boolean;
	titleWidth?: string;
	showDescription?: boolean;
	descriptionLines?: number;
	showFooter?: boolean;
	showAvatar?: boolean;
	className?: string;
	ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
	showImage: true,
	imageHeight: "12rem",
	showTitle: true,
	titleWidth: "80%",
	showDescription: true,
	descriptionLines: 2,
	showFooter: true,
	showAvatar: true,
	className: "",
	ariaLabel: "Loading card content...",
});
</script>