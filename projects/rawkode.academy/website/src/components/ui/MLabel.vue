<template>
	<span :class="['m-label', toneClass]" :style="$attrs.style">
		<slot name="leading" />
		<slot />
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
	defineProps<{
		tone?: "muted" | "ink" | "soft" | "accent" | "amber" | "rust" | "spruce";
	}>(),
	{ tone: "muted" },
);

const toneClass = computed(() => `m-label--${props.tone}`);
</script>

<style scoped>
.m-label {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.6875rem;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.14em;
	line-height: 1;
}

.m-label--muted   { color: var(--editorial-ink-mute); }
.m-label--soft    { color: var(--editorial-ink-soft); }
.m-label--ink     { color: var(--editorial-ink); }
.m-label--accent  { color: var(--editorial-spruce); }
.m-label--amber   { color: var(--editorial-amber-text); }
.m-label--rust    { color: var(--editorial-rust); }
.m-label--spruce  { color: var(--editorial-spruce); }
</style>
