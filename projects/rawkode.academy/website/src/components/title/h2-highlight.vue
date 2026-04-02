<script setup lang="ts">
import WordHighlighter from "vue-word-highlighter";
import { css } from "styled-system/css";

interface Props {
	title: string;
	// Space separated strings to highlight
	highlightWords: string;
}

defineProps<Props>();

const sectionStyle = css({ overflow: 'hidden' });
const containerStyle = css({ px: '4', mx: 'auto' });
const headingStyle = css({ fontSize: { base: '3xl', md: '4xl', xl: '6xl' }, fontWeight: 'bold', fontFamily: 'display', textAlign: 'center', letterSpacing: 'tight', lineHeight: 'none' });
</script>

<style>
mark {
	background-image: linear-gradient(to bottom right, var(--colors-brand-primary), var(--colors-brand-secondary));
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
</style>

<template>
	<section :class="sectionStyle">
		<div :class="containerStyle">
			<h2 :class="headingStyle">
				<WordHighlighter :split-by-space=true :query=highlightWords>{{ title }}
				</WordHighlighter>
			</h2>
		</div>
	</section>
</template>
