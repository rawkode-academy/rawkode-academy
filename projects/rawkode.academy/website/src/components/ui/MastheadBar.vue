<template>
	<div class="masthead">
		<div class="masthead__left">
			<MLabel tone="ink">{{ left }}</MLabel>
		</div>
		<div v-if="quote" class="masthead__center">
			<span class="masthead__quote">"{{ quote }}"</span>
			<span v-if="quoteSource" class="masthead__source"> — {{ quoteSource }}</span>
		</div>
		<div class="masthead__right">
			<MLabel tone="ink">{{ right }}</MLabel>
		</div>
	</div>
</template>

<script setup lang="ts">
import MLabel from "./MLabel.vue";

defineProps<{
	left: string;
	right: string;
	quote?: string;
	quoteSource?: string;
}>();
</script>

<style scoped>
.masthead {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 2rem;
	padding: 1rem 2.5rem;
	border-bottom: 2px solid var(--editorial-ink);
}

.masthead__center {
	flex: 1 1 auto;
	text-align: center;
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-size: 0.9375rem;
	letter-spacing: 0;
	text-transform: none;
	color: var(--editorial-ink);
}

.masthead__source {
	color: var(--editorial-ink-mute);
}
</style>
