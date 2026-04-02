<script setup lang="ts">
import Accordion from "../ui/accordion.vue";
import { css } from "../../../styled-system/css";
import { sectionStyles, containerStyles, innerStyles } from "./styles";

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

const headingStyles = css({
	mb: "6",
	lg: { mb: "8" },
	fontSize: "3xl",
	lg: { fontSize: "4xl" },
	letterSpacing: "tight",
	fontWeight: "extrabold",
	textAlign: "center",
	color: { base: "gray.900", _dark: "white" },
});
</script>

<template>
	<section :class="sectionStyles">
		<div :class="containerStyles">
			<h2 :class="headingStyles">
				{{ title }}
			</h2>
			<div :class="innerStyles">
				<Accordion :items="faqItems" default-open-id="1" />
			</div>
		</div>
	</section>
</template>
