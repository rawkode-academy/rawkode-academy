<script setup lang="ts">
import Card from "../ui/Card.vue";

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
	<Card :href="`/read/${id}`" variant="paper" padding="none">
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

		<div class="p-6">
			<div class="ed-card__meta">
				<span class="ed-card__meta-tag">Article</span>
				<span class="ed-card__meta-sep">·</span>
				<span>{{ new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(publishedAt)) }}</span>
				<span v-if="readingTimeText" class="ed-card__meta-sep">·</span>
				<span v-if="readingTimeText">{{ readingTimeText }}</span>
			</div>
			<h2 class="ed-card__title">{{ title }}</h2>
			<p v-if="subtitle" class="ed-card__body">{{ subtitle }}</p>
		</div>

		<template #footer>
			<div class="ed-card__footer">
				<div class="ed-card__avatars">
					<div
						v-for="(author, index) in authors.slice(0, 3)"
						:key="author.handle"
						class="ed-card__avatar"
						:style="`z-index: ${10 - index}`"
					>
						<img
							:src="`https://avatars.githubusercontent.com/${author.handle}`"
							:alt="`Profile picture of ${author.name}`"
							loading="lazy"
						/>
					</div>
					<div v-if="authors.length > 3" class="ed-card__avatar ed-card__avatar--more">
						+{{ authors.length - 3 }}
					</div>
				</div>
				<div class="ed-card__authors">{{ authors.map(a => a.name).join(", ") }}</div>
			</div>
		</template>
	</Card>
</template>

<style scoped>
.ed-card__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	align-items: center;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.6875rem;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.14em;
	color: var(--editorial-ink-mute);
	margin-bottom: 0.875rem;
}
.ed-card__meta-tag { color: var(--editorial-spruce); }
.ed-card__meta-sep { opacity: 0.4; }

.ed-card__title {
	font-family: var(--font-instrument-serif), serif;
	font-style: italic;
	font-weight: 400;
	font-size: 1.5rem;
	line-height: 1.08;
	letter-spacing: -0.025em;
	color: var(--editorial-ink);
	margin: 0 0 0.75rem;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.ed-card__body {
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.9rem;
	line-height: 1.5;
	color: var(--editorial-ink-soft);
	margin: 0;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.ed-card__footer {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0 1.5rem 1rem;
}

.ed-card__avatars {
	display: flex;
}

.ed-card__avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	border: 1px solid var(--editorial-hairline);
	background: var(--editorial-paper-deep);
	overflow: hidden;
	margin-left: -8px;
	position: relative;
}

.ed-card__avatar:first-child { margin-left: 0; }

.ed-card__avatar img { width: 100%; height: 100%; object-fit: cover; }

.ed-card__avatar--more {
	display: grid;
	place-items: center;
	font-family: var(--font-jetbrains-mono), monospace;
	font-size: 0.65rem;
	color: var(--editorial-ink-mute);
}

.ed-card__authors {
	font-family: var(--font-inter-tight), sans-serif;
	font-size: 0.8rem;
	color: var(--editorial-ink-soft);
}
</style>
