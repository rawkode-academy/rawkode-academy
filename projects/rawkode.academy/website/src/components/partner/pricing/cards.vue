<script setup lang="ts">
interface PricingFeature {
	text: string;
	description?: string;
}

interface PricingPlan {
	title: string;
	price: string;
	description: string;
	features: PricingFeature[];
	ctaText: string;
	popular?: boolean;
}

const pricingPlans: PricingPlan[] = [
	{
		title: "Nip",
		price: "12,000",
		description: "Essential visibility and quarterly engagement with our developer community.",
		ctaText: "Get Started",
		features: [
			{
				text: "Featured Partner Placement",
				description: "Your brand prominently displayed on our homepage and partners page with company description and industry classification"
			},
			{
				text: "Quarterly Live Stream",
				description: "Collaborative live coding sessions or product demonstrations to showcase your technology"
			},
			{
				text: "Social Media Promotion",
				description: "Mentions across our social channels highlighting your partnership"
			},
		],
	},
	{
		title: "Dram",
		price: "24,000",
		description: "Targeted developer outreach with customized content creation to showcase your technology.",
		ctaText: "Grow Together",
		popular: true,
		features: [
			{
				text: "Everything in Nip",
				description: "All features from the Nip partnership tier"
			},
			{
				text: "32 Hours of Consulting or Content",
				description: "Dedicated time for strategic consulting or creating tailored content that highlights your product"
			},
			{
				text: "Quarterly Strategy Sessions",
				description: "Regular meetings to align content and engagement with your business goals"
			},
		],
	},
	{
		title: "Blend",
		price: "48,000",
		description: "Extensive collaboration with significant developer engagement opportunities and strategic guidance.",
		ctaText: "Accelerate Growth",
		features: [
			{
				text: "Everything in Dram",
				description: "All features from the Dram partnership tier"
			},
			{
				text: "64 Hours of Consulting or Content",
				description: "Expanded dedicated time for strategic consulting or creating premium content"
			},
			{
				text: "Go-to-Market Strategy Support",
				description: "Expert guidance on positioning your product for developer adoption"
			},
			{
				text: "Priority Content Calendar Placement",
				description: "Preferred scheduling for your content and promotional activities"
			}
		],
	}
]
</script>

<template>
	<div class="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-10 lg:space-y-0">
		<div v-for="plan in pricingPlans"
			class="flex flex-col p-6 mx-auto max-w-lg text-center text-gray-900 bg-white rounded-lg border border-gray-100 shadow dark:border-gray-600 xl:p-8 dark:bg-gray-800 dark:text-white transition-all duration-300 hover:shadow-xl hover:drop-shadow-xl hover:scale-[1.02]"
			:class="{ 'border-secondary dark:border-secondary border-2 relative': plan.popular }">

			<div v-if="plan.popular"
				class="absolute top-0 right-0 px-3 py-1 bg-secondary text-white text-xs font-semibold rounded-bl-lg rounded-tr-lg">
				Popular Choice
			</div>

			<h3 class="mb-4 text-2xl font-semibold">{{ plan.title }}</h3>
			<p class="min-h-24 font-light text-gray-500 sm:text-lg dark:text-gray-400">{{
				plan.description }}</p>
			<div class="grid justify-center my-8">
				<div class="text-5xl font-extrabold">{{ plan.price }}</div>
				<div class="text-gray-500 dark:text-gray-400">USD / annually</div>
			</div>

			<!-- List -->
			<ul role="list" class="mb-8 space-y-4 text-left min-h-64">
				<li v-for="feature in plan.features" class="flex items-start space-x-3 mb-4">
					<!-- Icon -->
					<svg class="flex-shrink-0 w-5 h-5 mt-1 text-green-500 dark:text-green-400" fill="currentColor"
						viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
						<path fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"></path>
					</svg>
					<div>
						<span class="font-medium text-gray-800 dark:text-gray-200">{{ feature.text }}</span>
						<p v-if="feature.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
							{{ feature.description }}
						</p>
					</div>
				</li>
			</ul>

			<a href="/organizations/lets-chat"
				class="text-white bg-primary hover:bg-secondary focus:ring-4 focus:ring-primary/30 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:text-white dark:focus:ring-primary/30 mt-auto">
				{{ plan.ctaText }}
			</a>
		</div>
	</div>
</template>
