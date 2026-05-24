<template>
	<div :class="[wrapperClasses, className]">
		<div class="ed-section-bar"></div>
		<div :class="textClasses">
			<h2 class="ed-section-title">{{ title }}</h2>
			<p v-if="subtitle" class="ed-section-subtitle">{{ subtitle }}</p>
		</div>
		<div v-if="showSeparator" class="ed-section-rule"></div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
	title: string;
	subtitle?: string;
	showSeparator?: boolean;
	centered?: boolean;
	class?: string;
}

const props = withDefaults(defineProps<Props>(), {
	showSeparator: true,
	centered: false,
	class: "",
});

const className = props.class;
const wrapperClasses = computed(() => [
	"flex items-start gap-3 mb-8",
	props.centered ? "justify-center text-center" : "",
]);
const textClasses = computed(() => [
	"flex flex-col",
	props.centered ? "items-center text-center" : "",
]);
</script>

<style scoped>
.ed-section-bar {
	width: 2px;
	height: 2.5rem;
	background: var(--editorial-ink);
	flex-shrink: 0;
}

.ed-section-title {
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-weight: 400;
	font-size: clamp(1.5rem, 3vw, 2.25rem);
	line-height: 1.05;
	letter-spacing: -0.025em;
	color: var(--editorial-ink);
	margin: 0;
}

.ed-section-subtitle {
	margin-top: 0.4rem;
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.95rem;
	color: var(--editorial-ink-soft);
	max-width: 40rem;
}

.ed-section-rule {
	margin-left: 1rem;
	height: 1px;
	flex-grow: 1;
	background: var(--editorial-hairline);
	align-self: center;
}
</style>
