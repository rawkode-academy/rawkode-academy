<script setup lang="ts">
import WordHighlighter from "vue-word-highlighter";

interface Props {
	title: string;
	// Space separated strings to highlight
	highlightWords: string;
}

defineProps<Props>();
</script>

<style lang="postcss" module>
mark {
	@apply bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent;
}
</style>

<template>
	<section class="overflow-hidden">
		<div class="container px-4 mx-auto">
			<h2 class="text-2xl md:text-4xl xl:text-6xl font-bold font-heading text-center tracking-px-n leading-none">
				<WordHighlighter :split-by-space=true :query=highlightWords>{{ title }}
				</WordHighlighter>
			</h2>
		</div>
	</section>
</template>
