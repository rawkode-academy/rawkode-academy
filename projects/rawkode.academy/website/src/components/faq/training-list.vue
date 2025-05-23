<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-(--breakpoint-xl) sm:py-16 lg:px-6 ">
			<div class="mx-auto max-w-(--breakpoint-md)">
				<div id="accordion-flush" data-accordion="collapse"
					data-active-classes="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
					data-inactive-classes="text-gray-500 dark:text-gray-400">
					<h2 id="accordion-flush-heading-1">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-900 bg-white border-b border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
							data-accordion-target="#accordion-flush-body-1" aria-expanded="true"
							aria-controls="accordion-flush-body-1">
							<span>How many people can attend a training session?</span>
							<svg data-accordion-icon="" class="w-6 h-6 rotate-180 shrink-0" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</button>
					</h2>
					<div id="accordion-flush-body-1" class="" aria-labelledby="accordion-flush-heading-1">
						<div class="py-5 border-b border-gray-200 dark:border-gray-700">
							<p class="mb-2 text-gray-600 dark:text-gray-300">For on-site workshops, we can accommodate up to 20 participants per instructor. For virtual live training, we recommend a maximum of 15 participants to ensure adequate interaction and support. For larger teams, we can arrange multiple sessions or provide additional instructors for an additional fee.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-2">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-2" aria-expanded="false"
							aria-controls="accordion-flush-body-2">
							<span>Do you provide training materials to participants?</span>
							<svg data-accordion-icon="" class="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</button>
					</h2>
					<div id="accordion-flush-body-2" class="hidden" aria-labelledby="accordion-flush-heading-2">
						<div class="py-5 border-b border-gray-200 dark:border-gray-700">
							<p class="mb-2 text-gray-600 dark:text-gray-300">Yes, all participants receive comprehensive digital training materials including slides, lab instructions, sample code, and additional resources for further learning. For virtual sessions, we also provide recordings of the training sessions that remain accessible for 30 days after the program concludes.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-3">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-3" aria-expanded="false"
							aria-controls="accordion-flush-body-3">
							<span>How far in advance should we book training?</span>
							<svg data-accordion-icon="" class="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</button>
					</h2>
					<div id="accordion-flush-body-3" class="hidden" aria-labelledby="accordion-flush-heading-3">
						<div class="py-5 border-b border-gray-200 dark:border-gray-700">
							<p class="mb-2 text-gray-600 dark:text-gray-300">We recommend booking at least 4-6 weeks in advance to ensure availability of our instructors and allow adequate time for customization. For on-site training that requires travel arrangements or custom program development, 8-12 weeks of lead time is ideal. However, we do try to accommodate urgent requests when possible.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-4">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-4" aria-expanded="false"
							aria-controls="accordion-flush-body-4">
							<span>What prerequisites should participants have?</span>
							<svg data-accordion-icon="" class="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</button>
					</h2>
					<div id="accordion-flush-body-4" class="hidden" aria-labelledby="accordion-flush-heading-4">
						<div class="py-5 border-b border-gray-200 dark:border-gray-700">
							<p class="mb-2 text-gray-600 dark:text-gray-300">Prerequisites vary by training program. For most technical training, participants should have basic command-line skills and familiarity with fundamental concepts like containerization or CI/CD. However, we tailor the difficulty level to match your team's experience. During our pre-training assessment, we'll identify any specific knowledge gaps and can recommend pre-training resources if necessary.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-5">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-5" aria-expanded="false"
							aria-controls="accordion-flush-body-5">
							<span>I have additional questions about training programs</span>
							<svg data-accordion-icon="" class="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg">
								<path fill-rule="evenodd"
									d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
									clip-rule="evenodd"></path>
							</svg>
						</button>
					</h2>
					<div id="accordion-flush-body-5" class="hidden" aria-labelledby="accordion-flush-heading-5">
						<div class="py-5 border-b border-gray-200 dark:border-gray-700">
							<p class="mb-2 text-gray-600 dark:text-gray-300">We'd be happy to discuss your specific training needs and answer any questions you may have. <a class="text-primary font-medium hover:underline"
									href="/organizations/lets-chat">Schedule a consultation</a> with our team to explore how we can help upskill your technical team.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>