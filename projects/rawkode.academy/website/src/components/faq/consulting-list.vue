<script setup lang="ts">
import FaqAccordion from "./accordion-wrapper.vue";

const faqItems = [
	{
		id: "1",
		question: "What technologies and platforms do you specialize in?",
		answer: `<p class="mb-2">We specialize in cloud native infrastructure and software development technologies, with particular expertise in:</p>
<ul class="list-disc pl-6 mb-2 space-y-1">
	<li>Infrastructure as Code using Terraform and Pulumi</li>
	<li>Kubernetes for both developers and operators</li>
	<li>Site Reliability Engineering (SRE) practices</li>
	<li>Observability with modern monitoring stacks</li>
	<li>Platform Engineering and internal developer platforms</li>
	<li>GitOps workflows and continuous delivery</li>
	<li>Software development in Rust and Go with DDD, BDD, and TDD practices</li>
</ul>`,
	},
	{
		id: "2",
		question: "Do you offer remote consulting services?",
		answer:
			'<p class="mb-2">Yes, we provide fully remote consulting services to clients worldwide. We use collaborative tools and structured processes that have proven effective for distributed teams. For certain engagements, we can also arrange for on-site work if required, though this may involve additional travel expenses.</p>',
	},
	{
		id: "3",
		question:
			"Can you help with migrating our infrastructure to Infrastructure as Code?",
		answer:
			'<p class="mb-2">Absolutely! We specialize in helping organizations migrate their existing infrastructure to Infrastructure as Code using Terraform or Pulumi. Our process involves a careful assessment of your current environment, creating a migration strategy, implementing the IaC solution with proper testing, and training your team on best practices. We handle everything from basic VM deployments to complex multi-cloud architectures.</p>',
	},
	{
		id: "4",
		question: "How quickly can you start a consulting engagement?",
		answer:
			'<p class="mb-2">Our typical lead time is 2-4 weeks from contract signing to project kickoff, depending on the scope of work and our current commitments. For urgent needs, we may be able to accommodate faster timelines – please discuss your timeframe during our initial consultation. We maintain a limited number of active engagements to ensure high-quality delivery for all clients.</p>',
	},
	{
		id: "5",
		question: "I have additional questions about consulting services",
		answer:
			'<p class="mb-2">We\'d be happy to discuss your specific technical challenges and answer any questions you may have. <a class="text-primary font-medium hover:underline" href="/organizations/lets-chat">Schedule a consultation</a> with our team to explore how we can help with your infrastructure, platform engineering, or software development needs.</p>',
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