<script setup lang="ts">
import Accordion from "../ui/accordion.vue";

interface FAQItem {
	question: string;
	answer: string;
}

interface Props {
	items?: FAQItem[];
	title?: string;
}

const props = withDefaults(defineProps<Props>(), {
	items: () => [],
	title: "Frequently Asked Questions",
});

// Transform items to include IDs
const faqItems = props.items.map((item, index) => ({
	id: String(index + 1),
	question: item.question,
	answer: item.answer,
}));
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-(--breakpoint-xl) sm:py-16 lg:px-6">
			<h2
				class="mb-6 lg:mb-8 text-3xl lg:text-4xl tracking-tight font-extrabold text-center text-gray-900 dark:text-white"
			>
				{{ title }}
			</h2>
			<div class="mx-auto max-w-(--breakpoint-md)">
				<Accordion :items="faqItems" default-open-id="1" />
			</div>
		</div>
	</section>
</template>