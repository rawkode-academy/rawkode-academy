<script setup lang="ts">
import FaqAccordion from "./accordion-wrapper.vue";

const faqItems = [
	{
		id: "1",
		question: "How many people can attend a training session?",
		answer:
			'<p class="mb-2">For on-site workshops, we can accommodate up to 20 participants per instructor. For virtual live training, we recommend a maximum of 15 participants to ensure adequate interaction and support. For larger teams, we can arrange multiple sessions or provide additional instructors for an additional fee.</p>',
	},
	{
		id: "2",
		question: "Do you provide training materials to participants?",
		answer:
			'<p class="mb-2">Yes, all participants receive comprehensive digital training materials including slides, lab instructions, sample code, and additional resources for further learning. For virtual sessions, we also provide recordings of the training sessions that remain accessible for 30 days after the program concludes.</p>',
	},
	{
		id: "3",
		question: "How far in advance should we book training?",
		answer:
			'<p class="mb-2">We recommend booking at least 4-6 weeks in advance to ensure availability of our instructors and allow adequate time for customization. For on-site training that requires travel arrangements or custom program development, 8-12 weeks of lead time is ideal. However, we do try to accommodate urgent requests when possible.</p>',
	},
	{
		id: "4",
		question: "What prerequisites should participants have?",
		answer:
			"<p class=\"mb-2\">Prerequisites vary by training program. For most technical training, participants should have basic command-line skills and familiarity with fundamental concepts like containerization or CI/CD. However, we tailor the difficulty level to match your team's experience. During our pre-training assessment, we'll identify any specific knowledge gaps and can recommend pre-training resources if necessary.</p>",
	},
	{
		id: "5",
		question: "I have additional questions about training programs",
		answer:
			'<p class="mb-2">We\'d be happy to discuss your specific training needs and answer any questions you may have. <a class="text-primary font-medium hover:underline" href="/organizations/lets-chat">Schedule a consultation</a> with our team to explore how we can help upskill your technical team.</p>',
	},
];
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-(--breakpoint-xl) sm:py-16 lg:px-6">
			<div class="mx-auto max-w-(--breakpoint-md)">
				<FaqAccordion :items="faqItems" default-open-id="1" />
			</div>
		</div>
	</section>
</template>