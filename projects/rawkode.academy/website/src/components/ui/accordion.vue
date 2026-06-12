<script setup lang="ts">
import { reactive } from "vue";

// Track analytics events client-side
const trackEvent = (event: string, properties?: Record<string, unknown>) => {
	try {
		(window as any).posthog?.capture(event, properties);
	} catch {
		// Ignore tracking errors
	}
};

interface AccordionItem {
	id: string;
	question: string;
	answer?: string;
}

interface Props {
	items: AccordionItem[];
	defaultOpenId?: string;
}

const props = defineProps<Props>();

// Use reactive state instead of Set for better reactivity
const openItems = reactive<Record<string, boolean>>(
	props.defaultOpenId ? { [props.defaultOpenId]: true } : {},
);

const toggleItem = (id: string) => {
	const wasOpen = openItems[id];
	openItems[id] = !openItems[id];
	// Track accordion toggle
	trackEvent("accordion_toggled", {
		item_id: id,
		action: wasOpen ? "collapsed" : "expanded",
	});
};

const isOpen = (id: string) => !!openItems[id];
</script>

<template>
	<div class="w-full">
		<div v-for="item in items" :key="item.id">
			<h2 :id="`accordion-heading-${item.id}`">
				<button
					type="button"
					class="flex justify-between items-center py-5 px-4 w-full font-medium text-left border-b border-[var(--surface-border)] transition-smooth focus-ring rounded-t-md hover:bg-[var(--surface-card-muted)]"
					:class="isOpen(item.id) ? 'text-primary-content bg-[var(--surface-card)]' : 'text-muted'"
					@click="toggleItem(item.id)"
					:aria-expanded="isOpen(item.id)"
					:aria-controls="`accordion-body-${item.id}`"
				>
					<span>{{ item.question }}</span>
					<svg
						class="w-6 h-6 shrink-0 transition-smooth"
						:class="{ 'rotate-180': isOpen(item.id) }"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fill-rule="evenodd"
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
							clip-rule="evenodd"
						></path>
					</svg>
				</button>
			</h2>
			<Transition
				enter-active-class="transition-smooth"
				leave-active-class="transition-smooth"
				enter-from-class="opacity-0 max-h-0"
				enter-to-class="opacity-100 max-h-screen"
				leave-from-class="opacity-100 max-h-screen"
				leave-to-class="opacity-0 max-h-0"
			>
				<div
					v-show="isOpen(item.id)"
					:id="`accordion-body-${item.id}`"
					:aria-labelledby="`accordion-heading-${item.id}`"
					role="region"
					class="overflow-hidden"
				>
					<div class="py-5 px-4 border-b border-[var(--surface-border)] bg-[var(--surface-card)]">
						<div class="text-secondary-content">
							<slot :name="`answer-${item.id}`">
								{{ item.answer }}
							</slot>
						</div>
					</div>
				</div>
			</Transition>
		</div>
	</div>
</template>