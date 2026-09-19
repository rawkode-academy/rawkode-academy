<script setup lang="ts">
import { Accordion } from "@ark-ui/vue/accordion";
import { ref } from "vue";

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
		try {
			(window as any).posthog?.capture("accordion_toggled", {
				item_id: id,
				action: details.value.includes(id) ? "expanded" : "collapsed",
			});
		} catch {
			// Analytics must never block disclosure interaction.
		}
	}
};
</script>

<template>
	<Accordion.Root
		:value="value"
		multiple
		collapsible
		class="w-full"
		@value-change="handleValueChange"
	>
		<Accordion.Item v-for="item in items" :key="item.id" :value="item.id">
			<Accordion.ItemTrigger
				class="accordion-trigger flex justify-between items-center py-5 px-4 w-full font-medium text-left border-b border-[var(--surface-border)] transition-smooth focus-ring rounded-t-md hover:bg-[var(--surface-card-muted)]"
			>
				<span>{{ item.question }}</span>
				<Accordion.ItemIndicator class="accordion-indicator">
					<svg class="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
						<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
					</svg>
				</Accordion.ItemIndicator>
			</Accordion.ItemTrigger>
			<Accordion.ItemContent class="accordion-content overflow-hidden">
				<div class="py-5 px-4 border-b border-[var(--surface-border)] bg-[var(--surface-card)]">
					<div class="text-secondary-content">
						<slot :name="`answer-${item.id}`">{{ item.answer }}</slot>
					</div>
				</div>
			</Accordion.ItemContent>
		</Accordion.Item>
	</Accordion.Root>
</template>

<style scoped>
.accordion-trigger { color: var(--text-muted); }
.accordion-trigger[data-state="open"] { color: var(--text-primary-content); background: var(--surface-card); }
.accordion-indicator { transition: transform var(--duration-base) var(--ease-standard); }
.accordion-indicator[data-state="open"] { transform: rotate(180deg); }
.accordion-content[data-state="open"] { animation: accordion-down var(--duration-base) var(--ease-standard); }
.accordion-content[data-state="closed"] { animation: accordion-up var(--duration-base) var(--ease-standard); }
@keyframes accordion-down { from { height: 0; opacity: 0; } to { height: var(--height); opacity: 1; } }
@keyframes accordion-up { from { height: var(--height); opacity: 1; } to { height: 0; opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .accordion-indicator, .accordion-content { animation: none !important; transition: none; } }
</style>
