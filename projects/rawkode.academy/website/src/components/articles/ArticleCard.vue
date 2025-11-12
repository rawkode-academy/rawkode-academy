<script setup lang="ts">
import Card from "../ui/Card.vue";
import Badge from "../common/Badge.vue";

interface Author {
	name: string;
	handle: string;
}

interface Props {
	id: string;
	title: string;
	subtitle?: string;
	cover?: {
		image: string;
		alt: string;
	};
	authors: Author[];
	publishedAt: Date;
	readingTimeText?: string;
}

defineProps<Props>();
</script>

<template>
	<Card :href="`/read/${id}`" variant="glass" padding="none">
		<template #badge>
			<Badge variant="primary" size="sm">Article</Badge>
		</template>

		<template #media>
			<img
				v-if="cover"
				class="w-full h-52 object-cover"
				:src="cover.image"
				:alt="cover.alt"
				loading="lazy"
			/>
			<img
				v-else
				class="w-full h-52 object-cover"
				src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/blog/office-laptops.png"
				alt="Default placeholder image for article without custom cover"
				loading="lazy"
			/>
		</template>

		<template #overlay>
			<div class="absolute inset-0 bg-gradient-to-tr from-primary/30 to-secondary/20 mix-blend-multiply"></div>
		</template>

		<div class="p-6">
			<h2 class="mb-3 text-xl font-bold tracking-tight text-primary-content line-clamp-2">
				{{ title }}
			</h2>
			<p v-if="subtitle" class="mb-4 font-light text-secondary-content line-clamp-3">
				{{ subtitle }}
			</p>
		</div>

		<template #footer>
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					<div class="flex -space-x-3">
						<div
							v-for="(author, index) in authors.slice(0, 3)"
							:key="author.handle"
							class="relative"
							:style="`z-index: ${10 - index}`"
						>
							<img
								class="w-10 h-10 rounded-full object-cover border-2 border-primary p-0.5 bg-white dark:bg-gray-800"
								:src="`https://avatars.githubusercontent.com/${author.handle}`"
								:alt="`Profile picture of ${author.name}`"
								loading="lazy"
							/>
							<span
								v-if="index === 0"
								class="absolute bottom-0 right-0 h-2.5 w-2.5 bg-secondary rounded-full border-2 border-white dark:border-gray-700"
							></span>
						</div>
						<div v-if="authors.length > 3" class="relative" style="z-index: 0;">
							<div class="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 border-2 border-primary p-0.5 bg-white dark:bg-gray-800 flex items-center justify-center text-xs text-primary dark:text-secondary font-medium">
								+{{ authors.length - 3 }}
							</div>
						</div>
					</div>
					<div class="font-medium text-primary-content">
						<div class="text-sm">{{ authors.map(a => a.name).join(", ") }}</div>
					</div>
				</div>
				<div class="flex items-center gap-3 text-xs text-muted">
					<div v-if="readingTimeText" class="flex items-center gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{{ readingTimeText }}
					</div>
					<div class="flex items-center gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						{{ new Intl.DateTimeFormat('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric'
						}).format(new Date(publishedAt)) }}
					</div>
				</div>
			</div>
		</template>
	</Card>
</template>
