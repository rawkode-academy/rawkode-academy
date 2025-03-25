<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-8 px-4 mx-auto max-w-screen-xl sm:py-16 lg:px-6 ">
			<div class="mx-auto max-w-screen-md">
				<div id="accordion-flush" data-accordion="collapse"
					data-active-classes="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
					data-inactive-classes="text-gray-500 dark:text-gray-400">
					<h2 id="accordion-flush-heading-1">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-900 bg-white border-b border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
							data-accordion-target="#accordion-flush-body-1" aria-expanded="true"
							aria-controls="accordion-flush-body-1">
							<span>What technologies and platforms do you specialize in?</span>
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
							<p class="mb-2 text-gray-600 dark:text-gray-300">We specialize in cloud native infrastructure and software development technologies, with particular expertise in:</p>
							<ul class="list-disc pl-6 mb-2 text-gray-600 dark:text-gray-300 space-y-1">
								<li>Infrastructure as Code using Terraform and Pulumi</li>
								<li>Kubernetes for both developers and operators</li>
								<li>Site Reliability Engineering (SRE) practices</li>
								<li>Observability with modern monitoring stacks</li>
								<li>Platform Engineering and internal developer platforms</li>
								<li>GitOps workflows and continuous delivery</li>
								<li>Software development in Rust and Go with DDD, BDD, and TDD practices</li>
							</ul>
						</div>
					</div>
					<h2 id="accordion-flush-heading-2">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-2" aria-expanded="false"
							aria-controls="accordion-flush-body-2">
							<span>Do you offer remote consulting services?</span>
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
							<p class="mb-2 text-gray-600 dark:text-gray-300">Yes, we provide fully remote consulting services to clients worldwide. We use collaborative tools and structured processes that have proven effective for distributed teams. For certain engagements, we can also arrange for on-site work if required, though this may involve additional travel expenses.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-3">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-3" aria-expanded="false"
							aria-controls="accordion-flush-body-3">
							<span>Can you help with migrating our infrastructure to Infrastructure as Code?</span>
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
							<p class="mb-2 text-gray-600 dark:text-gray-300">Absolutely! We specialize in helping organizations migrate their existing infrastructure to Infrastructure as Code using Terraform or Pulumi. Our process involves a careful assessment of your current environment, creating a migration strategy, implementing the IaC solution with proper testing, and training your team on best practices. We handle everything from basic VM deployments to complex multi-cloud architectures.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-4">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-4" aria-expanded="false"
							aria-controls="accordion-flush-body-4">
							<span>How quickly can you start a consulting engagement?</span>
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
							<p class="mb-2 text-gray-600 dark:text-gray-300">Our typical lead time is 2-4 weeks from contract signing to project kickoff, depending on the scope of work and our current commitments. For urgent needs, we may be able to accommodate faster timelines – please discuss your timeframe during our initial consultation. We maintain a limited number of active engagements to ensure high-quality delivery for all clients.</p>
						</div>
					</div>
					<h2 id="accordion-flush-heading-5">
						<button type="button"
							class="flex justify-between items-center py-5 w-full font-medium text-left text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400"
							data-accordion-target="#accordion-flush-body-5" aria-expanded="false"
							aria-controls="accordion-flush-body-5">
							<span>I have additional questions about consulting services</span>
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
							<p class="mb-2 text-gray-600 dark:text-gray-300">We'd be happy to discuss your specific technical challenges and answer any questions you may have. <a class="text-primary font-medium hover:underline"
									href="/organizations/lets-chat">Schedule a consultation</a> with our team to explore how we can help with your infrastructure, platform engineering, or software development needs.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>