<template>
	<div :class="doc.empty" :style="emptyAlignment">
		<p :class="doc.sectionTitle">{{ title }}</p>
		<p v-if="body || $slots.default" :class="doc.copy">
			<slot>{{ body }}</slot>
		</p>
		<div v-if="$slots.actions" :class="doc.actions">
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { academyDocument } from "@rawkodeacademy/design-system";
/**
 * Editorial empty state — the "loaded, but nothing here" counterpart to the
 * Skeleton* loading family. Serif italic line, optional body copy, and a row
 * of mono uppercase action links via the `actions` slot.
 */
const props = withDefaults(
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
const doc = academyDocument();
const emptyAlignment = computed(() =>
	props.align === "center"
		? undefined
		: { alignItems: "flex-start", textAlign: "left" },
);
</script>
