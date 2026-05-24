<template>
	<div :class="['kicker-strip', { 'kicker-strip--heavy': heavy }]">
		<slot name="leading">
			<LiveDot v-if="live" :color="dotColor" />
		</slot>

		<MLabel v-if="kicker" :tone="kickerTone">{{ kicker }}</MLabel>
		<span v-if="meta" class="kicker-strip__meta">{{ meta }}</span>

		<span class="kicker-strip__rule" aria-hidden="true" />

		<MLabel v-if="right" tone="muted">{{ right }}</MLabel>
		<slot name="trailing" />
	</div>
</template>

<script setup lang="ts">
import LiveDot from "./LiveDot.vue";
import MLabel from "./MLabel.vue";

withDefaults(
	defineProps<{
		kicker?: string;
		kickerTone?: "muted" | "ink" | "accent" | "amber" | "rust" | "spruce";
		meta?: string;
		right?: string;
		live?: boolean;
		dotColor?: "amber" | "spruce" | "rust";
		heavy?: boolean;
	}>(),
	{ kickerTone: "amber", live: false, dotColor: "amber", heavy: false },
);
</script>

<style scoped>
.kicker-strip {
	display: flex;
	align-items: center;
	gap: 1rem;
	padding: 0.875rem 2.5rem;
	border-top: 1px solid var(--editorial-hairline);
	border-bottom: 1px solid var(--editorial-hairline);
	font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
	font-size: 0.6875rem;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute);
}

.kicker-strip--heavy {
	border-top: 2px solid var(--editorial-ink);
	border-bottom: 1px solid var(--editorial-hairline);
}

.kicker-strip__meta {
	color: inherit;
}

.kicker-strip__rule {
	flex: 1;
	height: 1px;
	background: var(--editorial-hairline);
}
</style>
