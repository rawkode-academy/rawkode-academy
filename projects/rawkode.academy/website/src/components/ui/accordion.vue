<script setup lang="ts">
import { ref } from "vue";

interface AccordionItem {
	id: string;
	question: string;
	answer: string;
}

interface Props {
	items: AccordionItem[];
	defaultOpenId?: string;
}

const props = defineProps<Props>();

const openItems = ref<Set<string>>(
	new Set(props.defaultOpenId ? [props.defaultOpenId] : []),
);

const toggleItem = (id: string) => {
	if (openItems.value.has(id)) {
		openItems.value.delete(id);
	} else {
		openItems.value.add(id);
	}
};

const isOpen = (id: string) => openItems.value.has(id);
</script>

<template>
	<div class="w-full">
		<div v-for="item in items" :key="item.id">
			<h2 :id="`accordion-heading-${item.id}`">
				<button
					type="button"
					class="flex justify-between items-center py-5 w-full font-medium text-left border-b border-gray-200 dark:border-gray-700 transition-colors duration-200"
					:class="isOpen(item.id) ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'"
					@click="toggleItem(item.id)"
					:aria-expanded="isOpen(item.id)"
					:aria-controls="`accordion-body-${item.id}`"
				>
					<span>{{ item.question }}</span>
					<svg
						class="w-6 h-6 shrink-0 transition-transform duration-200"
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
				enter-active-class="transition-all duration-200 ease-out"
				leave-active-class="transition-all duration-200 ease-out"
				enter-from-class="opacity-0 max-h-0"
				enter-to-class="opacity-100 max-h-screen"
				leave-from-class="opacity-100 max-h-screen"
				leave-to-class="opacity-0 max-h-0"
			>
				<div
					v-show="isOpen(item.id)"
					:id="`accordion-body-${item.id}`"
					:aria-labelledby="`accordion-heading-${item.id}`"
					class="overflow-hidden"
				>
					<div class="py-5 border-b border-gray-200 dark:border-gray-700">
						<div v-html="item.answer" class="text-gray-600 dark:text-gray-300"></div>
					</div>
				</div>
			</Transition>
		</div>
	</div>
</template>