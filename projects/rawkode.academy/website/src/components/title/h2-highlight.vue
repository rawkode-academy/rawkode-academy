<script setup lang="ts">
import { css } from "../../../styled-system/css";
import WordHighlighter from "vue-word-highlighter";

interface Props {
	title: string;
	// Space separated strings to highlight
	highlightWords: string;
}

defineProps<Props>();
</script>

<style>
mark {
	background-image: linear-gradient(to bottom right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)));
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
</style>

<template>
	<section :class="css({ overflow: 'hidden' })">
		<div :class="css({ maxW: '7xl', px: '4', mx: 'auto' })">
			<h2 :class="css({ fontSize: { base: '3xl', md: '4xl', xl: '6xl' }, fontWeight: 'bold', fontFamily: 'display', textAlign: 'center', letterSpacing: 'tight', lineHeight: 'none' })">
				<WordHighlighter :split-by-space=true :query=highlightWords>{{ title }}
				</WordHighlighter>
			</h2>
		</div>
	</section>
</template>
