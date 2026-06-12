<template>
	<div class="empty-state" role="status">
		<p class="empty-state__title">{{ title }}</p>
		<p v-if="body || $slots.default" class="empty-state__body">
			<slot>{{ body }}</slot>
		</p>
		<div v-if="$slots.actions" class="empty-state__actions">
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Editorial empty state — the "loaded, but nothing here" counterpart to the
 * Skeleton* loading family. Serif italic line, optional body copy, and a row
 * of mono uppercase action links via the `actions` slot.
 */
withDefaults(
	defineProps<{
		title: string;
		body?: string;
		align?: "center" | "start";
	}>(),
	{
		body: undefined,
		align: "center",
	},
);
</script>

<style scoped>
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: v-bind("align === 'center' ? 'center' : 'flex-start'");
	text-align: v-bind("align === 'center' ? 'center' : 'left'");
	gap: 0.625rem;
	padding: 2.5rem 1.5rem;
	border: 1px solid var(--editorial-hairline);
	border-radius: var(--radius-sm);
	background: var(--surface-card-muted);
}

.empty-state__title {
	margin: 0;
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-weight: 400;
	font-size: 1.5rem;
	line-height: 1.15;
	color: var(--editorial-ink-soft);
	text-wrap: balance;
}

.empty-state__body {
	margin: 0;
	max-width: 44rem;
	font-family: var(--font-inter-tight), system-ui, sans-serif;
	font-size: 0.9375rem;
	line-height: 1.5;
	color: var(--editorial-ink-mute);
}

.empty-state__body :deep(a) {
	color: var(--editorial-spruce);
	text-decoration: underline;
	text-underline-offset: 2px;
}

.empty-state__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem 1.5rem;
	margin-top: 0.375rem;
}

.empty-state__actions :deep(a) {
	display: inline-flex;
	align-items: center;
	min-height: 2.75rem;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.6875rem;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--editorial-spruce);
	text-decoration: none;
}

.empty-state__actions :deep(a:hover) {
	text-decoration: underline;
	text-decoration-thickness: 1px;
	text-underline-offset: 0.35em;
}
</style>
