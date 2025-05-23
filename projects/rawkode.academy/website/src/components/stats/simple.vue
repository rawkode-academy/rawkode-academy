<script setup lang="ts">
interface Props {
	title: string;
	stats: Stat[];
}

interface Stat {
	label: string;
	value: string;
}

defineProps<Props>();
</script>

<template>
	<section class="bg-white dark:bg-gray-900">
		<div class="px-4 mx-auto max-w-(--breakpoint-xl) lg:px-6 xl:px-0">
			<div class="mx-auto max-w-(--breakpoint-md) text-center">
				<h2 class="text-3xl tracking-tight font-extrabold text-gray-900 md:text-4xl dark:text-white">{{ title }}</h2>
			</div>
			<div class="max-w-(--breakpoint-xl) px-4 mx-auto text-center lg:py-16 lg:px-6">
				<dl class="grid max-w-(--breakpoint-md) gap-8 mx-auto text-gray-900 sm:grid-cols-3 dark:text-white">
					<div v-for="stat in stats" class="flex flex-col items-center justify-center">
						<dt class="mb-2 text-4xl md:text-5xl font-extrabold">{{ stat.value }}</dt>
						<dd class="font-light text-gray-500 dark:text-gray-400">{{ stat.label }}</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>
</template>
