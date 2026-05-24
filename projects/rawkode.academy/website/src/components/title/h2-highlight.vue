<script setup lang="ts">
import WordHighlighter from "vue-word-highlighter";

interface Props {
	title: string;
	// Space separated strings to highlight
	highlightWords: string;
}

defineProps<Props>();
</script>

<style scoped>
/* Editorial highlight: serif italic ink, no gradient text. */
:deep(mark) {
	background: transparent;
	color: var(--editorial-ink);
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-weight: 400;
}
</style>

<template>
	<section class="overflow-hidden">
		<div class="container px-4 mx-auto">
			<h2 class="text-3xl md:text-4xl xl:text-6xl font-normal italic text-center" style="font-family: var(--font-instrument-serif), serif; color: var(--editorial-ink); letter-spacing: -0.025em; line-height: 1.05;">
				<WordHighlighter :split-by-space=true :query=highlightWords>{{ title }}
				</WordHighlighter>
			</h2>
		</div>
	</section>
</template>
