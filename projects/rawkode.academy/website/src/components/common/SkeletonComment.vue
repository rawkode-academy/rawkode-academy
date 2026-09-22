<template>
	<div
		:class="skeleton.row"
		role="status"
		:aria-label="ariaLabel"
	>
		<span class="sr-only">{{ ariaLabel }}</span>
		<!-- Avatar skeleton -->
		<div
			:class="skeleton.avatar"
			:style="{
				width: '2.5rem',
				height: '2.5rem',
			}"
		/>

		<!-- Comment content -->
		<div :class="skeleton.content">
			<!-- Header with author and timestamp -->
			<div :class="skeleton.meta">
				<div
					:class="skeleton.lineMedium"
					style="width: 120px"
				/>
				<div
					:class="skeleton.lineSmall"
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
import { academySkeleton } from "@rawkodeacademy/design-system";
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
const skeleton = academySkeleton();
</script>
