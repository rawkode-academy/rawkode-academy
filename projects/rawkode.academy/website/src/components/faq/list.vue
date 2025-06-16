<script setup lang="ts">
import Accordion from "../ui/accordion.vue";

const faqItems = [
	{
		id: "1",
		question: "What is the minimum partnership duration?",
		answer:
			'<p class="mb-2">Our partnerships are structured as annual engagements to ensure we can deliver meaningful results. Developer marketing and education require a strategic, long-term approach to build awareness, trust, and adoption. Our experience shows that sustained engagement over time yields significantly better outcomes than short-term campaigns.</p>',
	},
	{
		id: "2",
		question: "What are the payment terms for partnerships?",
		answer:
			'<p class="mb-2">For Nip and Dram partnerships, we typically require annual payment upfront. For Blend and Malt partnerships, we offer flexible payment options including quarterly or semi-annual installments. We\'re happy to discuss payment structures that align with your budgeting cycles during our consultation.</p>',
	},
	{
		id: "3",
		question: "How do you measure partnership success?",
		answer:
			'<p class="mb-2">We provide comprehensive analytics and reporting tailored to your specific goals. Metrics typically include content engagement (views, watch time, interactions), developer sentiment, community growth, and when possible, product adoption indicators. All partnerships include regular performance reviews to ensure we\'re delivering value and to refine our approach as needed.</p><p class="mb-2">For partners at the Blend and Malt tiers, we also provide deeper insights into developer behavior and preferences, helping you refine your product and go-to-market strategy.</p>',
	},
	{
		id: "4",
		question: "How do you qualify potential partners?",
		answer:
			"<p class=\"mb-2\">We partner with companies that offer genuine value to developers and align with our mission of advancing developer education. We evaluate potential partners based on their technology's innovation, market relevance, and potential impact on the developer community. We're selective in our partnerships to ensure we can authentically advocate for your products.</p>",
	},
	{
		id: "5",
		question: "I have additional questions about partnerships",
		answer:
			'<p class="mb-2">We\'d be happy to discuss your specific needs and answer any questions you may have. <a class="text-primary font-medium hover:underline" href="/organizations/lets-chat">Schedule a consultation</a> with our partnership team to explore how we can work together to achieve your developer marketing and education goals.</p>',
	},
];
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-(--breakpoint-xl) sm:py-16 lg:px-6">
			<h2
				class="mb-6 lg:mb-8 text-3xl lg:text-4xl tracking-tight font-extrabold text-center text-gray-900 dark:text-white"
			>
				Partnership FAQ
			</h2>
			<div class="mx-auto max-w-(--breakpoint-md)">
				<Accordion :items="faqItems" default-open-id="1" />
			</div>
		</div>
	</section>
</template>