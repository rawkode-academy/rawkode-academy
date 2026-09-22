<template>
	<div
		:class="skeleton.stack"
		role="status"
		aria-label="Loading transcript..."
	>
		<span class="sr-only">Loading transcript...</span>
		<!-- Search bar skeleton -->
		<div>
			<div
				:class="skeleton.line"
				style="height: 42px"
			/>
		</div>

		<!-- Transcript paragraphs skeleton -->
		<div :class="skeleton.stack">
			<div v-for="i in 4" :key="i" :class="skeleton.stack">
				<!-- Timestamp -->
				<div
					:class="skeleton.line"
					:style="{
						height: '1rem',
						width: getTimestampWidth(i),
					}"
				/>
				<!-- Paragraph text -->
				<SkeletonText
					:lines="getParagraphLines(i)"
					:line-height="'1.25rem'"
					:last-line-width="getLastLineWidth(i)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academySkeleton } from "@rawkodeacademy/design-system";
import SkeletonText from "./SkeletonText.vue";

const skeleton = academySkeleton();

const getTimestampWidth = (index: number): string => {
	const widths = ["80px", "85px", "75px", "82px"];
	return widths[index % widths.length] || "80px";
};

const getParagraphLines = (index: number): number => {
	const lines = [4, 3, 5, 3];
	return lines[index % lines.length] || 3;
};

const getLastLineWidth = (index: number): string => {
	const widths = ["65%", "80%", "70%", "55%"];
	return widths[index % widths.length] || "70%";
};
</script>
