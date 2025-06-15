<script setup lang="ts">
const props = defineProps({
	title: String,
});
</script>

<template>
			<div class="mx-auto px-6 pb-32 pt-36 sm:pt-60 lg:px-8 lg:pt-32">
				<div class="mx-auto gap-x-14 lg:mx-0 lg:flex  lg:items-center">
					<div class="relative w-full lg:shrink-0">
					<h1>{{ props.title }}</h1>
						<p class="mt-6 text-lg leading-8 text-gray-600">Join our community of learners exploring cloud native technologies together. We offer hands-on content designed to help everyone succeed, regardless of background or experience level. Our inclusive approach ensures that all participants can engage and grow their skills.</p>
				<div class="mt-10 flex items-center gap-x-6">
					<a href="#"
						class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Get
						started</a>
					<a href="#" class="text-sm font-semibold leading-6 text-gray-900">Live demo <span
							aria-hidden="true">→</span></a>
				</div>
			</div>
			<div class="mt-14 flex justify-end gap-8 sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
				<div
					class="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">
					<div class="relative">
						<img
							src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
							alt="Person working with technology" class="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg" loading="lazy" />
						<div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
					</div>
				</div>
				<div class="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
					<div class="relative">
						<img
							src="https://images.unsplash.com/photo-1485217988980-11786ced9454?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
							alt="Team members collaborating" class="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg" loading="lazy" />
						<div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
					</div>
					<div class="relative">
						<img
							src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&crop=focalpoint&fp-x=.4&w=396&h=528&q=80"
							alt="People engaged in learning" class="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg" loading="lazy" />
						<div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
					</div>
				</div>
				<div class="w-44 flex-none space-y-8 pt-32 sm:pt-0">
					<div class="relative">
						<img
							src="https://images.unsplash.com/photo-1670272504528-790c24957dda?ixlib=rb-4.0.3&ixid=MnwxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&crop=left&w=400&h=528&q=80"
							alt="Collaborative workspace setup" class="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg" loading="lazy" />
						<div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
					</div>
					<div class="relative">
						<img
							src="https://images.unsplash.com/photo-1670272505284-8faba1c31f7d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&h=528&q=80"
							alt="Technology environment for learning" class="aspect-2/3 w-full rounded-xl bg-gray-900/5 object-cover shadow-lg" loading="lazy" />
						<div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
