<template>
	<MLabel :tone="tone" class="section-mark">
		<template v-if="dot" #leading>
			<span class="section-mark__dot" :style="{ background: dotColor }" />
		</template>
		<span class="section-mark__num">§{{ paddedNum }}</span>
		<span v-if="label" class="section-mark__sep">·</span>
		<span v-if="label">{{ label }}</span>
	</MLabel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MLabel from "./MLabel.vue";

const props = withDefaults(
	defineProps<{
		num: number | string;
		label?: string;
		dot?: boolean;
		tone?: "muted" | "soft" | "ink" | "accent" | "amber" | "rust" | "spruce";
	}>(),
	{ dot: false, tone: "accent" },
);

const paddedNum = computed(() => {
	const v = String(props.num);
	return v.length === 1 ? `0${v}` : v;
});

const dotColor = computed(
	() =>
		({
			amber: "var(--editorial-amber)",
			rust: "var(--editorial-rust)",
			spruce: "var(--editorial-spruce)",
			ink: "var(--editorial-ink)",
			accent: "var(--editorial-spruce)",
			soft: "var(--editorial-ink-soft)",
			muted: "var(--editorial-ink-mute)",
		})[props.tone],
);
</script>

<style scoped>
.section-mark__dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}

.section-mark__sep {
	opacity: 0.4;
}
</style>
