<template>
	<nav
		class="section-rail"
		:aria-label="ariaLabel"
		:style="{ '--section-rail-cols': items.length }"
	>
		<a
			v-for="(item, i) in items"
			:key="item.num"
			:href="item.href"
			class="section-rail__item"
			:class="{ 'section-rail__item--first': i === 0 }"
		>
			<MLabel tone="accent">§{{ pad(item.num) }}</MLabel>
			<span class="section-rail__label">{{ item.label }}</span>
			<span class="section-rail__arrow" aria-hidden="true">→</span>
		</a>
	</nav>
</template>

<script setup lang="ts">
import MLabel from "./MLabel.vue";

interface Item {
	num: number | string;
	label: string;
	href: string;
}

withDefaults(
	defineProps<{
		items: Item[];
		ariaLabel?: string;
	}>(),
	{ ariaLabel: "Section navigation" },
);

const pad = (v: number | string) => {
	const s = String(v);
	return s.length === 1 ? `0${s}` : s;
};
</script>

<style scoped>
.section-rail {
	display: grid;
	grid-template-columns: repeat(var(--section-rail-cols, 1), minmax(0, 1fr));
	border-top: 1px solid var(--editorial-hairline);
	border-bottom: 1px solid var(--editorial-hairline);
}

.section-rail__item {
	display: flex;
	align-items: baseline;
	gap: 0.75rem;
	padding: 1.1rem 1.25rem;
	border-left: 1px solid var(--editorial-hairline);
	text-decoration: none;
	transition: background-color var(--duration-base) var(--ease-standard);
}

.section-rail__item--first {
	border-left: none;
}

/* Small viewports: stack the rail vertically so it never overflows. */
@media (max-width: 640px) {
	.section-rail {
		grid-template-columns: minmax(0, 1fr);
	}

	.section-rail__item {
		border-left: none;
		border-top: 1px solid var(--editorial-hairline);
	}

	.section-rail__item--first {
		border-top: none;
	}
}

.section-rail__item:hover {
	background: var(--surface-card-muted);
}

.section-rail__label {
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.9375rem;
	color: var(--editorial-ink);
}

.section-rail__arrow {
	margin-left: auto;
	color: var(--editorial-ink-mute);
}
</style>
