<script setup lang="ts">
interface PricingPlan {
	title: string;
	price: number;
	description: string;
	features: string[];
}

const pricingPlans: PricingPlan[] = [
	{
		title: "Nip",
		price: 12,000,
		description: "A nip is what we offer people from our hip flasks, which means a sip of whisky.",
		features: [
			"Website Placement",
			"Quarterly Live Stream",
		],
	},
	{
		title: "Dram",
		price: 24,000,
		description: "A dram means a small pour of whisky, shot sized.",
		features: [
			"Website Placement",
			"Quarterly Live Stream",
			"32 Hours of Consulting or Content Creation",
		],
	},
	{
		title: "Blend",
		price: 48,000,
		description: "There’s nothing wrong with a good ole’ blended whisky, as Johnnie Walker may have taught you.",
		features: [
			"Website Placement",
			"Quarterly Live Stream",
			"64 Hours of Consulting or Content Creation",
			"Mid-roll on all free, unsponsored, content",
		],
	}
]
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
			<div class="mx-auto max-w-screen-md text-center mb-8 lg:mb-12">
				<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">Partnership Plans</h2>
				<p class="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">It doesn't matter if you're here to
					support our mission or because you need help with go to market, product market fit, developer marketing, or
					straight up content; we have plans for all use-cases.</p>
			</div>

			<div class="mx-auto max-w-screen-md text-center mb-8 lg:mb-12">
				<p class="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">The Rawkode Academy is proudly brought
					to
					you from Glasgow, Scotland. As such, our plans reflect a little bit of our heritage and culture.</p>
				<p class="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">🏴󠁧󠁢󠁳󠁣󠁴󠁿 🥃</p>
			</div>

			<div class="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-10 lg:space-y-0">
				<div v-for="plan in pricingPlans"
					class="flex flex-col p-6 mx-auto max-w-lg text-center text-gray-900 bg-white rounded-lg border border-gray-100 shadow dark:border-gray-600 xl:p-8 dark:bg-gray-800 dark:text-white">
					<h3 class="mb-4 text-2xl font-semibold">{{ plan.title }}</h3>
					<p class="min-h-32 font-light text-gray-500 sm:text-lg dark:text-gray-400">{{
						plan.description }}</p>
					<div class="grid justify-center my-8">
						<div class="text-5xl font-extrabold">{{ plan.price }}</div>
						<div class="text-gray-500 dark:text-gray-400">USD / annually</div>
					</div>
					<!-- List -->
					<ul role="list" class="mb-8 space-y-4 text-left min-h-64">
						<li v-for="feature in plan.features" class="flex items-center space-x-3">
							<!-- Icon -->
							<svg class="min-h-8 flex-shrink-0 w-5 h-5 text-green-500 dark:text-green-400" fill="currentColor"
								viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"></path>
							</svg>
							<span>{{ feature }}</span>
						</li>
					</ul>
					<a href="/organizations/lets-chat"
						class="text-white bg-primary hover:bg-secondary focus:ring-4 focus:secondary font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:text-white  dark:focus:secondary">Let's
						Collaborate</a>
				</div>
			</div>

		</div>
	</section>
</template>
