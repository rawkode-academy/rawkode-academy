<script setup lang="ts">
import { onMounted, ref } from "vue";
import Accordion from "../ui/accordion.vue";

interface FaqItem {
	id: string;
	question: string;
	answer: string;
}

interface Props {
	items: FaqItem[];
	defaultOpenId?: string;
}

const props = defineProps<Props>();
const isClient = ref(false);

onMounted(() => {
	isClient.value = true;
});

const sanitizeAnswer = (html: string) => {
	if (!isClient.value) return "";
	
	// Use browser's built-in DOMParser for client-side sanitization
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	
	// Remove script tags and event handlers
	const scripts = doc.querySelectorAll("script");
	scripts.forEach(script => script.remove());
	
	// Remove inline event handlers
	const allElements = doc.querySelectorAll("*");
	allElements.forEach(element => {
		Array.from(element.attributes).forEach(attr => {
			if (attr.name.startsWith("on")) {
				element.removeAttribute(attr.name);
			}
		});
	});
	
	return doc.body.innerHTML;
};
</script>

<template>
	<Accordion :items="items" :default-open-id="defaultOpenId">
		<template v-for="item in items" :key="item.id" v-slot:[`answer-${item.id}`]>
			<div v-if="isClient" v-html="sanitizeAnswer(item.answer)"></div>
			<div v-else>{{ item.answer.replace(/<[^>]*>/g, '') }}</div>
		</template>
	</Accordion>
</template>