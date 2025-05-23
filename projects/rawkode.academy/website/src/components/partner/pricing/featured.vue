<script setup lang="ts">
interface PricingFeature {
	text: string;
	description: string;
}

interface PricingPlan {
	title: string;
	price: string;
	description: string;
	features: PricingFeature[];
	ctaText: string;
}

const maltPricingPlan: PricingPlan = {
	title: "Malt",
	price: "96,000",
	description: "Premier Partnership - Our highest tier of collaboration, featuring comprehensive support and maximum visibility.",
	ctaText: "Become a Premier Partner",
	features: [
		{
			text: "Everything in Blend",
			description: "All features from the Blend partnership tier"
		},
		{
			text: "80 Hours of Consulting or Content Creation",
			description: "Extensive dedicated time for strategic consulting, product positioning, and premium content development"
		},
		{
			text: "Executive Advisory Sessions",
			description: "Direct access to our team for strategic guidance and industry insights"
		},
		{
			text: "Co-Marketing Opportunities",
			description: "Joint marketing initiatives including co-branded content, webinars, and promotional campaigns"
		},
	],
};
</script>

<template>
	<div
		class="my-4 mb-12 border-4 border-secondary bg-white rounded-lg shadow lg:grid lg:grid-cols-3 dark:bg-gray-800 transition-all duration-300 hover:shadow-2xl hover:drop-shadow-2xl hover:scale-[1.02] relative">
		<div
			class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-bold">
			Premier Partnership
		</div>
		<div class="col-span-2 p-6 lg:p-8">
			<h2 class="mb-3 text-3xl font-bold text-gray-900 dark:text-white">{{ maltPricingPlan.title }}</h2>
			<p class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-6">{{ maltPricingPlan.description }}</p>
			<div class="grid gap-4 mt-4 lg:mt-6">
				<!-- List -->
				<ul role="list" class="space-y-6 dark:text-white">
					<li v-for="feature in maltPricingPlan.features" class="flex items-start space-x-3">
						<!-- Icon -->
						<svg class="shrink-0 w-5 h-5 mt-1 text-secondary" fill="currentColor" viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg">
							<path fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"></path>
						</svg>
						<div>
							<span class="font-medium text-gray-800 dark:text-gray-200">{{ feature.text }}</span>
							<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
								{{ feature.description }}
							</p>
						</div>
					</li>
				</ul>
			</div>
		</div>
		<div class="flex p-6 text-center bg-gray-50 lg:p-8 dark:bg-gray-700">
			<div class="self-center w-full">
				<div class="text-5xl font-extrabold text-gray-900 dark:text-white">{{ maltPricingPlan.price }}</div>
				<div class="mt-1 mb-6 text-gray-500 text-light dark:text-gray-400">USD / annually</div>
				<div class="mb-6 text-sm text-gray-600 dark:text-gray-300">
					Maximize your developer engagement and product adoption with our most comprehensive partnership tier
				</div>
				<a href="/organizations/lets-chat"
					class="flex justify-center text-white bg-secondary hover:bg-primary focus:ring-4 focus:ring-secondary/30 font-medium rounded-lg text-sm px-5 py-3 text-center transition-colors duration-300">
					{{ maltPricingPlan.ctaText }}
				</a>
			</div>
		</div>
	</div>
</template>
