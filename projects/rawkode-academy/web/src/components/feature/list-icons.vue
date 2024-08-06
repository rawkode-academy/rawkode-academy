<script setup lang="ts">
interface Offering {
	title: string;
	color: string;
	description: string;
	features: string[];
}

const offerings: Offering[] = [
	{
		title: "Developer Marketing",
		color: "primary",
		description: "We Inspire Developers",
		features: [
			"Conference & User Group Speaking",
			"Podcast Interviews",
			"Product Reviews",
			"Release Highlights",
			"Short-Form Content",
			"Social Media Campaigns",
			"Thought Leadership",
		]
	},
	{
		title: "Developer Education",
		color: "secondary",
		description: "We Level-Up Developers",
		features: [
			"Blogging",
			"Hackathons",
			"Live Coding",
			"Long-Form Content",
			"Online Courses",
			"Webinars",
			"Workshops",
		]
	},
	{
		title: "Developer Experience",
		color: "tertiary",
		description: "We Support Developers",
		features: [
			"Documentation",
			"Go To Market Strategy",
			"Product Market Fit",
			"Roadmap Consultation",
			"User Testing",
		]
	}
];
</script>
<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-screen-xl sm:py-16 lg:px-6">
			<div class="max-w-screen-md mb-8 lg:mb-16">
				<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">Want to partner with us?
				</h2>
				<p class="font-light text-gray-500 dark:text-gray-400 sm:text-xl">We only work with partners where we
					truly
					believe their mission can help enrich the lives of developers. Only when our message is authentic, we can
					truly deliver on our promise to help you grow.</p>
				<p class="mt-4 text-black dark:text-white sm:text-xl">We deliver on that promise with the following:
				</p>
			</div>
			<div class="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 xl:gap-12 md:space-y-0">
				<div v-for="offer in offerings">
					<div
						:class="`flex justify-center items-center mb-4 w-10 h-10 bg-${offer.color} rounded dark:bg-${offer.color} lg:h-16 lg:w-16`">
						<svg :class="`w-5 h-5 text-white lg:w-8 lg:h-8`" fill="currentColor" viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg">
							<path fill-rule="evenodd"
								d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"></path>
						</svg>
					</div>
					<h3 :class="`mb-2 text-xl font-bold text-black dark:text-white`">{{ offer.title }}</h3>
					<ul role="list" class="my-6 lg:mb-0 space-y-4">
						<li v-for="feature in offer.features" class="flex space-x-2.5">
							<!-- Icon -->
							<svg :class="`flex-shrink-0 w-5 h-5 text-${offer.color}`" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"></path>
							</svg>
							<span class="leading-tight text-gray-500 dark:text-gray-400">{{ feature }}</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>
