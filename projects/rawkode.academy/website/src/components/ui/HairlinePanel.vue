<template>
	<div :class="['hairline-panel', `hairline-panel--${variant}`, { 'hairline-panel--heavy': heavy }]">
		<slot />
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		variant?: "paper" | "paper-deep" | "muted" | "ink";
		heavy?: boolean;
	}>(),
	{ variant: "paper-deep", heavy: false },
);
</script>

<style scoped>
.hairline-panel {
	position: relative;
	border: 1px solid var(--editorial-hairline);
	border-radius: var(--radius-md);
}

.hairline-panel--paper      { background: var(--editorial-paper); }
.hairline-panel--paper-deep { background: var(--editorial-paper-deep); }
.hairline-panel--muted      { background: var(--surface-card-muted); }
.hairline-panel--ink        {
	background: oklch(0.12 0.01 280);
	border-color: oklch(1 0 0 / 0.12);
	color: var(--editorial-paper);
}

.hairline-panel--heavy {
	border-color: var(--editorial-ink);
	border-width: 2px;
}
</style>
