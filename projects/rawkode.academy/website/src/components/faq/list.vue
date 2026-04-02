<script setup lang="ts">
import Accordion from "../ui/accordion.vue";
import { css } from "../../../styled-system/css";

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

const sectionStyle = css({ bg: { base: 'white', _dark: 'gray.900' } });
const containerStyle = css({ py: { base: '8', sm: '16' }, px: { base: '4', lg: '6' }, mx: 'auto', maxW: 'breakpoint-xl' });
const headingStyle = css({ mb: { base: '6', lg: '8' }, fontSize: { base: '3xl', lg: '4xl' }, letterSpacing: 'tight', fontWeight: 'extrabold', textAlign: 'center', color: { base: 'gray.900', _dark: 'white' } });
const innerStyle = css({ mx: 'auto', maxW: 'breakpoint-md' });
</script>

<template>
	<section :class="sectionStyle">
		<div :class="containerStyle">
			<h2 :class="headingStyle">
				{{ title }}
			</h2>
			<div :class="innerStyle">
				<Accordion :items="faqItems" default-open-id="1" />
			</div>
		</div>
	</section>
</template>
