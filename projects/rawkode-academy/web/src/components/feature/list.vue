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
		<div class="py-8 px-4 mx-auto sm:py-16 lg:px-6">
			<div class="mb-8 lg:mb-16">
				<h2>{{ title }}</h2>
				<p class="text-gray-500 sm:text-xl dark:text-gray-400">{{ description }}</p>
			</div>
			<div class="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-12 md:space-y-0">
				<div v-for="item in segments">
					<div
						class="text-3xl">
						{{ item.emoji || "😼" }}
					</div>
					<h3 class="mb-2 text-xl font-bold dark:text-white">{{ item.title }}</h3>
					<p class="text-gray-500 dark:text-gray-400">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
