<script setup lang="ts">
interface PricingPlan {
	title: string;
	price: number;
	description: string;
	features: string[];
}

const maltPricingPlan: PricingPlan = {
	title: "Malt",
	price: 96000,
	description: "The finest of the whiskies, a malt is a single grain, single barrel, and single malt. Only the best for you.",
	features: [
		"Website Placement",
		"Quarterly Live Stream",
		"80 Hours of Consulting or Content Creation",
		"Pre-roll on all free, unsponsored, content",
		"2 Hour Course on Your Product, technology, or pattern of choice"
	],
};
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
			<div class="border-4 border-secondary bg-white rounded-lg shadow lg:grid lg:grid-cols-3 dark:bg-gray-800">
				<div class="col-span-2 p-6 lg:p-8">
					<h2 class="mb-1 text-2xl font-bold text-gray-900 dark:text-white">{{ maltPricingPlan.title }}</h2>
					<p class="text-lg font-light text-gray-500 dark:text-gray-400">{{ maltPricingPlan.description }}</p>
					<div class="grid gap-4 mt-4 lg:mt-6">
						<!-- List -->
						<ul role="list" class="space-y-4 dark:text-white">
							<li v-for="feature in maltPricingPlan.features" class="flex space-x-2.5">
								<!-- Icon -->
								<svg class="flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400" fill="currentColor"
									viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
									<path fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"></path>
								</svg>
								<span class="leading-tight text-gray-500 dark:text-gray-400">{{ feature }}</span>
							</li>
						</ul>
					</div>
				</div>
				<div class="flex p-6 text-center bg-gray-50 lg:p-8 dark:bg-gray-700">
					<div class="self-center w-full">
						<div class="text-5xl font-extrabold text-gray-900 dark:text-white">{{ maltPricingPlan.price }}</div>
						<div class="mt-1 mb-4 text-gray-500 text-light dark:text-gray-400">USD / anually</div>
						<a href="#"
							class="flex justify-center text-white bg-primary hover:bg-secondary focus:ring-4 focus:ring-bue-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Let's
							Excel Together</a>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
