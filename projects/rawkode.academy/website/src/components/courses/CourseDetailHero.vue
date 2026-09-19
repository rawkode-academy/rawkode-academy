<template>
	<section :class="doc.hero">
		<div :class="doc.container">
			<div :class="doc.split">
				<div :class="doc.stack">
					<div :class="[doc.rule, doc.stack]">
						<div :class="doc.kicker">
							<span :class="doc.link">Free &amp; Open Source Course</span>
							<span
								v-if="availableModuleCount > 0 && availableModuleCount < moduleCount"
								:class="doc.row"
							>
								<span :class="doc.dot"></span>
								{{ availableModuleCount }} available now
							</span>
						</div>

						<div :class="doc.stack">
							<h1
								:class="doc.title"
							>
								{{ title }}
							</h1>
							<p :class="doc.lede">
								{{ description }}
							</p>
						</div>
					</div>

					<div :class="doc.stats">
						<div :class="doc.stackSmall">
							<div :class="doc.kicker">Modules</div>
							<div>
								<div :class="doc.sectionTitle">{{ moduleCount }}</div>
								<p :class="doc.copy">Planned lessons across the course.</p>
							</div>
						</div>

						<div :class="doc.stackSmall">
							<div :class="doc.kicker">Live Now</div>
							<div>
								<div :class="doc.sectionTitle">
									{{ availableModuleCount || moduleCount }}
								</div>
								<p :class="doc.copy">Start with the published path today.</p>
							</div>
						</div>

						<div :class="doc.stackSmall">
							<div :class="doc.kicker">Pace</div>
							<div>
								<div :class="doc.sectionTitle">{{ totalDuration }}</div>
								<p :class="doc.copy">Structured for self-paced study.</p>
							</div>
						</div>

						<div :class="doc.stackSmall">
							<div :class="doc.kicker">Level</div>
							<div>
								<div :class="doc.sectionTitle">{{ difficulty }}</div>
								<p :class="doc.copy">Real implementation detail, not fluff.</p>
							</div>
						</div>
					</div>

					<div
						v-if="learningPath.length > 0"
						:class="[doc.rule, doc.stack]"
					>
						<div :class="doc.rowBetween">
							<div :class="doc.stack">
								<div :class="doc.kicker">Learning Path</div>
								<p :class="doc.copy">
									The course follows a clear sequence so each module pays off in the next one.
								</p>
							</div>
							<p :class="doc.kicker">
								{{ learningPath.length }} steps
							</p>
						</div>

						<div :class="doc.list">
							<div
								v-for="(step, index) in learningPath"
								:key="`${index}-${step}`"
								:class="doc.step"
							>
								<div :class="doc.link">0{{ index + 1 }}</div>
								<p :class="doc.copy">{{ step }}</p>
							</div>
						</div>
					</div>

					<div :class="doc.rowBetween">
						<div :class="doc.actions">
							<template v-for="author in authors" :key="author.name">
								<img
									v-if="author.avatarUrl"
									:src="author.avatarUrl"
									:alt="author.name"
									:class="doc.avatar"
									loading="lazy"
								/>
								<div
									v-else
									:class="doc.avatarInitials"
								>
									{{ author.name.charAt(0) }}
								</div>
							</template>

							<div :class="doc.main">
								<p :class="doc.kicker">Taught by</p>
								<p :class="doc.copy">
									{{ authors.map((author) => author.name).join(", ") }}
								</p>
							</div>
						</div>

						<a href="#course-content" :class="doc.button">
							Jump to the curriculum
						</a>
					</div>
				</div>

				<aside :class="doc.sidebar">
					<div :class="[doc.rule, doc.stack]">
						<div :class="doc.stackSmall">
							<div :class="doc.kicker">Course Updates</div>
							<h2 :class="doc.sectionTitle">
								Follow along as new modules land
							</h2>
							<p :class="doc.copy">
								Sign up once and we’ll send the next lesson when it ships, along with relevant notes and source updates.
							</p>
						</div>

						<slot name="signup-form" />

						<div :class="doc.rule">
							<h3 :class="doc.kicker">
								Included
							</h3>
							<ul :class="doc.copy">
								<li :class="doc.row">
									<span :class="doc.link">•</span>
									<span>Module release notifications for this course</span>
								</li>
								<li :class="doc.row">
									<span :class="doc.link">•</span>
									<span>Source code, demos, and supporting material where available</span>
								</li>
								<li :class="doc.row">
									<span :class="doc.link">•</span>
									<span>Practical guidance for building and running cloud native systems</span>
								</li>
							</ul>
						</div>
					</div>
				</aside>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import { academyDocument } from "@rawkodeacademy/design-system";
const doc = academyDocument();

interface Author {
	name: string;
	avatarUrl?: string | undefined;
}

interface Props {
	title: string;
	description: string;
	moduleCount: number;
	availableModuleCount: number;
	totalDuration: string;
	difficulty: string;
	learningPath: string[];
	authors: Author[];
}

defineProps<Props>();
</script>
