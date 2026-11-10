<script setup lang="ts">
import { Accordion } from "@ark-ui/vue/accordion";
import { ref } from "vue";
import { capture } from "@/lib/analytics/track";

interface AccordionItem {
	id: string;
	question: string;
	answer?: string;
}

const props = defineProps<{ items: AccordionItem[]; defaultOpenId?: string }>();
const value = ref(props.defaultOpenId ? [props.defaultOpenId] : []);

const handleValueChange = (details: { value: string[] }) => {
	const previous = new Set(value.value);
	value.value = details.value;
	for (const id of new Set([...previous, ...details.value])) {
		if (previous.has(id) === details.value.includes(id)) continue;
		capture("accordion_toggled", {
			item_id: id,
			action: details.value.includes(id) ? "expanded" : "collapsed",
		});
	}
};
</script>

<template>
	<Accordion.Root
		:value="value"
		multiple
		collapsible
		class="accordion"
		@value-change="handleValueChange"
	>
		<Accordion.Item v-for="item in items" :key="item.id" :value="item.id">
			<Accordion.ItemTrigger class="accordion-trigger">
				<span>{{ item.question }}</span>
				<Accordion.ItemIndicator class="accordion-indicator">
					<svg class="accordion-icon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
						<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent class="accordion-content">
				<div class="accordion-panel">
					<slot :name="`answer-${item.id}`">{{ item.answer }}</slot>
				</div>
			</Accordion.ItemContent>
		</Accordion.Item>
	</Accordion.Root>
</template>

<style scoped>
.accordion {
	width: 100%;
}

.accordion-trigger {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	padding: 1.25rem 1rem;
	border-bottom: 1px solid var(--colors-academy-border);
	border-radius: var(--radii-academy-s) var(--radii-academy-s) 0 0;
	color: var(--colors-academy-text-muted);
	font-weight: 500;
	text-align: left;
	transition:
		background-color var(--durations-base) var(--easings-academy-standard),
		color var(--durations-base) var(--easings-academy-standard);
}

.accordion-trigger:hover {
	background: color-mix(in srgb, var(--colors-academy-text) 4%, transparent);
}

.accordion-trigger:focus-visible {
	outline: 2px solid var(--colors-academy-accent);
	outline-offset: 2px;
}

.accordion-trigger[data-state="open"] {
	color: var(--colors-academy-text);
	background: var(--colors-academy-panel);
}

.accordion-indicator {
	transition: transform var(--durations-base) var(--easings-academy-standard);
}

.accordion-indicator[data-state="open"] {
	transform: rotate(180deg);
}

.accordion-icon {
	width: 1.5rem;
	height: 1.5rem;
	flex-shrink: 0;
}

.accordion-content {
	overflow: hidden;
}

.accordion-content[data-state="open"] {
	animation: accordion-down var(--durations-base) var(--easings-academy-standard);
}

.accordion-content[data-state="closed"] {
	animation: accordion-up var(--durations-base) var(--easings-academy-standard);
}

.accordion-panel {
	padding: 1.25rem 1rem;
	border-bottom: 1px solid var(--colors-academy-border);
	background: var(--colors-academy-panel);
	color: var(--colors-academy-text-soft);
}

@keyframes accordion-down {
	from {
		height: 0;
		opacity: 0;
	}
	to {
		height: var(--height);
		opacity: 1;
	}
}

@keyframes accordion-up {
	from {
		height: var(--height);
		opacity: 1;
	}
	to {
		height: 0;
		opacity: 0;
	}
}

@media (prefers-reduced-motion: reduce) {
	.accordion-trigger,
	.accordion-indicator,
	.accordion-content {
		animation: none !important;
		transition: none;
	}
}
</style>
