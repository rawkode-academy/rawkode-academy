<template>
	<div :class="className" role="status" :aria-label="ariaLabel">
		<span class="sr-only">{{ ariaLabel }}</span>
		<div
			v-if="showImage"
			:class="[skeleton.line, 'skeleton-card__image']"
			:style="{ height: imageHeight }"
		/>
		<SkeletonText :lines="1" line-height="1.25rem" last-line-width="70%" />
		<SkeletonText
			v-if="showDescription"
			class-name="skeleton-card__description"
			:lines="descriptionLines"
			line-height="0.875rem"
			last-line-width="60%"
		/>
		<div v-if="showFooter" class="skeleton-card__footer">
			<div :class="[skeleton.avatar, 'skeleton-card__avatar']" />
			<SkeletonText
				class-name="skeleton-card__byline"
				:lines="1"
				line-height="0.75rem"
				last-line-width="45%"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academySkeleton } from "@rawkodeacademy/design-system";
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

const skeleton = academySkeleton();
</script>

<style scoped>
.skeleton-card__image {
	margin-block-end: var(--spacing-4);
}

.skeleton-card__description {
	margin-block-start: var(--spacing-3);
}

.skeleton-card__footer {
	display: flex;
	align-items: center;
	gap: var(--spacing-3);
	margin-block-start: var(--spacing-4);
}

.skeleton-card__avatar {
	width: var(--sizes-8);
	height: var(--sizes-8);
}

.skeleton-card__byline {
	flex: 1;
}
</style>
