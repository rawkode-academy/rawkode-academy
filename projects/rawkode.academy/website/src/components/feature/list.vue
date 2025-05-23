<script setup lang="ts">
interface Props {
	title: string;
	description: string;
	segments: Segment[];
}

interface Segment {
	title: string;
	description: string;
	emoji?: string;
}

defineProps<Props>();
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="py-12 px-4 mx-auto sm:py-20 lg:px-6 max-w-7xl">
			<div class="mb-10 lg:mb-16 text-center">
				<h2 class="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">{{ title }}</h2>
				<p class="text-gray-600 sm:text-xl dark:text-gray-400 max-w-3xl mx-auto">{{ description }}</p>
			</div>
			<div class="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-12 md:space-y-0">
				<div v-for="item in segments" class="p-6 rounded-lg transition-all duration-300 hover:shadow-md dark:hover:shadow-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
					<div class="flex justify-center items-center mb-4 w-12 h-12 rounded-full bg-linear-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20">
						<span class="text-3xl">{{ item.emoji || "😼" }}</span>
					</div>
					<h3 class="mb-3 text-xl font-bold dark:text-white">{{ item.title }}</h3>
					<p class="text-gray-600 dark:text-gray-400">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
