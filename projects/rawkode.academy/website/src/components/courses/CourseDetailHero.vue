<template>
	<section :class="s.detailHero" aria-labelledby="course-title">
		<div :class="s.detailContainer">
			<div :class="cover ? s.heroGrid : s.heroCopy">
				<div :class="s.heroCopy">
					<nav v-if="breadcrumbs?.length" :class="nav.breadcrumb" aria-label="Breadcrumb">
						<ol :class="nav.trail">
							<li v-for="(crumb, index) in breadcrumbs" :key="crumb.link">
								<span v-if="index > 0" :class="nav.separator" aria-hidden="true">/</span>
								<a :href="crumb.link" :class="nav.crumb">{{ crumb.title }}</a>
							</li>
						</ol>
					</nav>
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
					<ul v-if="technologies?.length" :class="doc.tagList" aria-label="Technologies">
						<li v-for="tech in technologies" :key="tech.id">
							<a :href="`/technology/${tech.id}`" :class="doc.tag">{{ tech.name }}</a>
						</li>
					</ul>
					<a href="#course-content" :class="button()">View curriculum</a>
				</div>
				<div v-if="cover" :class="s.heroCoverFrame">
					<img
						:src="cover.src"
						:alt="cover.alt"
						:width="cover.width"
						:height="cover.height"
						:class="s.heroCover"
						crossorigin="anonymous"
						loading="eager"
						fetchpriority="high"
						decoding="async"
					/>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import {
	academyCourse,
	academyDocument,
	academyNavigation,
	button,
} from "@rawkodeacademy/design-system";

const s = academyCourse();
const doc = academyDocument();
const nav = academyNavigation();

interface Author {
	name: string;
	href: string;
	avatarUrl?: string | undefined;
}

interface BreadcrumbItem {
	title: string;
	link: string;
}

interface TechnologyTag {
	id: string;
	name: string;
}

interface Props {
	title: string;
	description: string;
	moduleCount: number;
	availableModuleCount: number;
	totalDuration?: string | undefined;
	difficulty: string;
	authors: Author[];
	breadcrumbs?: BreadcrumbItem[] | undefined;
	technologies?: TechnologyTag[] | undefined;
	cover?: { src: string; alt: string; width: number; height: number } | undefined;
}

defineProps<Props>();
</script>
