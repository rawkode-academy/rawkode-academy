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
		price: 1000,
		description: "A nip if what we offer people from our hip flasks, which means a sip of whisky.",
		features: [
			"Website Placement",
			"Quarterly Live Stream",
		],
	},
	{
		title: "Dram",
		price: 2000,
		description: "A dram means you’ve got a drink to yourself! Usually 25 ml of Scotland’s finest whisky; depending on how much you spend.",
		features: [
			"Website Placement",
			"Quarterly Live Stream",
			"32 Hours of Consulting or Content Creation",
		],
	},
	{
		title: "Blend",
		price: 4000,
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
				<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">Designed for business
					teams like yours</h2>
				<p class="mb-5 font-light text-gray-500 sm:text-xl dark:text-gray-400">Here at Flowbite we focus on markets
					where technology, innovation, and capital can unlock long-term value and drive economic growth.</p>
			</div>
			<div class="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-10 lg:space-y-0">
				<div v-for="plan in pricingPlans"
					class="flex flex-col p-6 mx-auto max-w-lg text-center text-gray-900 bg-white rounded-lg border border-gray-100 shadow dark:border-gray-600 xl:p-8 dark:bg-gray-800 dark:text-white">
					<h3 class="mb-4 text-2xl font-semibold">{{ plan.title }}</h3>
					<p class="min-h-32 font-light text-gray-500 sm:text-lg dark:text-gray-400">{{
						plan.description }}</p>
					<div class="flex justify-center items-baseline my-8">
						<span class="mr-2 text-5xl font-extrabold">{{ plan.price }}</span>
						<span class="text-gray-500 dark:text-gray-400">USD / month</span>
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
