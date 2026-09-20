<template>
	<section :class="s.detailHero" aria-labelledby="course-title">
		<div :class="s.detailContainer">
			<div :class="cover ? s.heroGrid : s.heroCopy">
				<div :class="s.heroCopy">
					<p :class="s.kicker">Course</p>
					<h1 id="course-title" :class="s.heroTitle">{{ title }}</h1>
					<p :class="s.heroDescription">{{ description }}</p>
					<ul :class="s.metadata" role="list" aria-label="Course details">
						<li>{{ availableModuleCount }} of {{ moduleCount }} lessons available</li>
						<li>{{ difficulty }}</li>
						<li v-if="totalDuration">{{ totalDuration }} of published lessons</li>
					</ul>
					<div v-if="authors.length" :class="s.byline">
						<span>Taught by</span>
						<a v-for="author in authors" :key="author.href" :href="author.href" :class="s.author">
							<img v-if="author.avatarUrl" :src="author.avatarUrl" alt="" width="28" height="28" :class="s.avatar" />
							{{ author.name }}
						</a>
					</div>
					<a href="#course-content" :class="s.curriculumAction">View curriculum</a>
				</div>
				<img
					v-if="cover"
					:src="cover.src"
					:alt="cover.alt"
					:width="cover.width"
					:height="cover.height"
					:class="s.heroCover"
					fetchpriority="high"
					decoding="async"
				/>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { academyCourse } from "@rawkodeacademy/design-system";

const s = academyCourse();

interface Author {
	name: string;
	href: string;
	avatarUrl?: string | undefined;
}

interface Props {
	title: string;
	description: string;
	moduleCount: number;
	availableModuleCount: number;
	totalDuration?: string | undefined;
	difficulty: string;
	authors: Author[];
	cover?: { src: string; alt: string; width: number; height: number } | undefined;
}

defineProps<Props>();
</script>
