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
	<section class="relative px-4 py-12 sm:py-20">
		<div class="pointer-events-none absolute inset-0 flex justify-center">
			<div class="h-full w-3/4 max-w-5xl rounded-full bg-gradient-to-r from-primary/20 via-white/40 to-secondary/20 blur-[160px] opacity-30 dark:from-primary/40 dark:via-gray-900/40 dark:to-secondary/40"></div>
		</div>
		<div class="glass-panel relative mx-auto max-w-7xl rounded-[32px] px-4 py-12 sm:px-10">
			<div class="mb-10 lg:mb-16 text-center">
				<h2 class="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">{{ title }}</h2>
				<p class="text-gray-600 sm:text-xl dark:text-gray-300 max-w-3xl mx-auto">{{ description }}</p>
			</div>
			<div class="space-y-6 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
				<div
					v-for="item in segments"
					class="group glass-card rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_30px_60px_rgba(95,94,215,0.25)]"
				>
					<div class="flex justify-center items-center mb-4 w-12 h-12 rounded-2xl bg-linear-to-br from-primary/15 to-secondary/15 dark:from-primary/25 dark:to-secondary/25 shadow-inner shadow-white/30">
						<span class="text-2xl">{{ item.emoji || "😼" }}</span>
					</div>
					<h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">{{ item.title }}</h3>
					<p class="text-gray-600 dark:text-gray-300 leading-relaxed">{{ item.description }}</p>
				</div>
			</div>
		</div>
	</section>
</template>
