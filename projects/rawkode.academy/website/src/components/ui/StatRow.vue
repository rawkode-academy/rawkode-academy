<template>
	<div class="stat-row" :style="{ '--cols': cols }">
		<div
			v-for="(stat, i) in stats"
			:key="i"
			class="stat-row__cell"
			:class="{ 'stat-row__cell--first': i === 0 }"
		>
			<div class="stat-row__num">{{ stat.value }}</div>
			<MLabel :tone="captionTone">{{ stat.label }}</MLabel>
			<div v-if="stat.note" class="stat-row__note">{{ stat.note }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MLabel from "./MLabel.vue";

interface Stat { value: string; label: string; note?: string }

const props = withDefaults(
	defineProps<{
		stats: Stat[];
		captionTone?: "muted" | "soft" | "ink" | "accent";
	}>(),
	{ captionTone: "ink" },
);

const cols = computed(() => props.stats.length);
</script>

<style scoped>
.stat-row {
	display: grid;
	grid-template-columns: repeat(var(--cols), 1fr);
	border-top: 1px solid var(--editorial-hairline);
	padding-top: 1.4rem;
}

.stat-row__cell {
	padding-left: 1.25rem;
	border-left: 1px solid var(--editorial-hairline);
}

.stat-row__cell--first {
	padding-left: 0;
	border-left: none;
}

.stat-row__num {
	font-family: var(--font-instrument-serif), serif;
	font-size: 2.625rem;
	font-style: italic;
	line-height: 1;
	letter-spacing: -0.02em;
	margin-bottom: 0.4rem;
	color: var(--editorial-ink);
}

.stat-row__note {
	margin-top: 0.3rem;
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.78rem;
	color: var(--editorial-ink-mute);
}

@media (max-width: 560px) {
	/* On phone widths a 4-column row at 42px italic crowds badly.
	   Drop to two columns with a tighter numeral so values like "353+"
	   stop running off the right edge of their cell. */
	.stat-row {
		grid-template-columns: repeat(2, 1fr);
		gap: 1.25rem 0;
	}
	.stat-row__cell {
		padding-left: 1rem;
	}
	.stat-row__cell:nth-child(odd) {
		padding-left: 0;
		border-left: none;
	}
	.stat-row__num {
		font-size: 2rem;
	}
}
</style>
