<template>
	<div
		class="transcript-skeleton"
		role="status"
		aria-label="Loading transcript..."
	>
		<span :class="css({ srOnly: true })">Loading transcript...</span>
		<!-- Search bar skeleton -->
		<div :class="css({ mb: '4' })">
			<div
				:class="css({
					animation: 'pulse',
					bg: { base: 'gray.200', _dark: 'gray.700' },
					borderRadius: 'lg',
				})"
				style="height: 42px"
			/>
		</div>

		<!-- Transcript paragraphs skeleton -->
		<div :class="css({ display: 'flex', flexDirection: 'column', gap: '6' })">
			<div v-for="i in 4" :key="i" class="transcript-paragraph-skeleton">
				<!-- Timestamp -->
				<div
					:class="css({
						animation: 'pulse',
						bg: 'colorPalette.default/20',
						borderRadius: 'md',
						mb: '2',
					})"
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
import { css } from "../../../styled-system/css";
import SkeletonText from "./SkeletonText.vue";

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
