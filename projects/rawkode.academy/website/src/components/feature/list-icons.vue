<script setup lang="ts">
interface Offering {
	title: string;
	color: string;
	description: string;
	tagline: string;
	features: Array<{
		name: string;
		description: string;
	}>;
}

const offerings: Offering[] = [
	{
		title: "Developer Marketing",
		color: "primary",
		description: "We Inspire Developers",
		tagline: "Drive awareness and generate excitement around your technology",
		features: [
			{
				name: "Conference & User Group Speaking",
				description: "Expert representation at industry events"
			},
			{
				name: "Podcast Interviews",
				description: "Storytelling that highlights your product vision"
			},
			{
				name: "Product Reviews",
				description: "Authentic evaluations from a developer perspective"
			},
			{
				name: "Release Highlights",
				description: "Showcase new features and improvements"
			},
			{
				name: "Short-Form Content",
				description: "Engaging technical demonstrations"
			},
			{
				name: "Social Media Campaigns",
				description: "Targeted outreach to developer communities"
			},
			{
				name: "Thought Leadership",
				description: "Position your brand as an industry innovator"
			}
		]
	},
	{
		title: "Developer Education",
		color: "secondary",
		description: "We Level-Up Developers",
		tagline: "Build developer competency and confidence with your technology",
		features: [
			{
				name: "Blogging",
				description: "In-depth technical articles and tutorials"
			},
			{
				name: "Hackathons",
				description: "Hands-on challenges that showcase your platform"
			},
			{
				name: "Live Coding",
				description: "Real-time implementation and problem-solving"
			},
			{
				name: "Long-Form Content",
				description: "Comprehensive guides and case studies"
			},
			{
				name: "Online Courses",
				description: "Structured learning paths for your technology"
			},
			{
				name: "Webinars",
				description: "Interactive demonstrations and Q&A sessions"
			},
			{
				name: "Workshops",
				description: "Guided implementation with expert instruction"
			}
		]
	},
	{
		title: "Developer Experience",
		color: "tertiary",
		description: "We Support Developers",
		tagline: "Optimize your product strategy for developer success",
		features: [
			{
				name: "Documentation Review",
				description: "Enhance clarity and completeness of technical guides"
			},
			{
				name: "Go-To-Market Strategy",
				description: "Developer-focused launch and adoption planning"
			},
			{
				name: "Product-Market Fit Analysis",
				description: "Identify opportunities to better serve developer needs"
			},
			{
				name: "Roadmap Consultation",
				description: "Strategic guidance on feature prioritization"
			},
			{
				name: "User Experience Testing",
				description: "Real-world feedback from developer perspective"
			}
		]
	}
];
</script>
<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-screen-xl sm:py-16 lg:px-6">
			<div class="max-w-screen-md mb-8 lg:mb-16">
				<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">Partner With Industry Experts</h2>
				<p class="font-light text-gray-500 dark:text-gray-400 sm:text-xl">We carefully select partners whose technologies genuinely enhance developers' work and lives. Our authentic approach ensures we can effectively advocate for your solutions and help you reach your growth objectives.</p>
				<p class="mt-4 text-black dark:text-white sm:text-xl font-medium">Our three-pillar approach to developer engagement:</p>
			</div>
			<div class="space-y-12 md:grid md:grid-cols-1 lg:grid-cols-3 md:gap-8 xl:gap-12 md:space-y-0">
				<div v-for="offer in offerings" 
					class="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300">
					<div class="flex items-center mb-4">
						<div :class="`flex justify-center items-center mr-4 w-12 h-12 bg-${offer.color} rounded-full dark:bg-${offer.color} lg:h-14 lg:w-14`">
							<svg class="w-6 h-6 text-white lg:w-7 lg:h-7" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"></path>
							</svg>
						</div>
						<div>
							<h3 class="text-2xl font-bold text-gray-900 dark:text-white">{{ offer.title }}</h3>
							<p :class="`text-${offer.color} font-medium`">{{ offer.description }}</p>
						</div>
					</div>
					
					<p class="mb-6 text-gray-700 dark:text-gray-300">{{ offer.tagline }}</p>
					
					<ul role="list" class="space-y-5">
						<li v-for="feature in offer.features" class="relative pl-8">
							<svg :class="`absolute left-0 top-1 w-5 h-5 text-${offer.color}`" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"></path>
							</svg>
							<div>
								<span class="font-medium text-gray-900 dark:text-white">{{ feature.name }}</span>
								<p class="text-sm text-gray-600 dark:text-gray-400">{{ feature.description }}</p>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>
