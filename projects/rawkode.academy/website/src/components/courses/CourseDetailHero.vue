<template>
	<section class="page-px section-py-tight">
		<div class="mx-auto max-w-7xl">
			<div
				class="relative overflow-hidden rounded-[2.5rem] border border-black/5 bg-white/55 px-6 py-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-slate-950/20 dark:shadow-[0_30px_80px_rgba(2,6,23,0.3)] sm:px-8 lg:px-10 lg:py-10"
			>
				<div class="pointer-events-none absolute inset-0">
					<div class="absolute -left-16 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl dark:bg-primary/12"></div>
					<div class="absolute right-0 top-8 h-72 w-72 rounded-full bg-secondary/10 blur-3xl dark:bg-secondary/12"></div>
					<div class="absolute inset-y-8 right-[23rem] hidden w-px bg-black/8 dark:bg-white/8 xl:block"></div>
				</div>

				<div class="relative grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_23rem] xl:items-start">
					<div class="space-y-8">
						<div class="space-y-5">
							<div class="flex flex-wrap gap-3">
								<span class="glass-chip text-primary">Free &amp; Open Source Course</span>
								<span
									v-if="availableModuleCount > 0 && availableModuleCount < moduleCount"
									class="glass-chip text-secondary-content"
								>
									{{ availableModuleCount }} available now
								</span>
							</div>

							<div class="max-w-4xl space-y-4">
								<h1
									class="text-4xl font-extrabold leading-[0.95] tracking-tight text-primary-content md:text-5xl"
								>
									{{ title }}
								</h1>
								<p class="max-w-[62ch] text-lg leading-8 text-secondary-content">
									{{ description }}
								</p>
							</div>
						</div>

						<div class="grid gap-5 border-t border-black/8 pt-6 dark:border-white/8 sm:grid-cols-2 xl:grid-cols-4">
							<div class="space-y-2">
								<div class="eyebrow-label tracking-[0.18em]">Modules</div>
								<div>
									<div class="text-3xl font-bold text-primary-content">{{ moduleCount }}</div>
									<p class="mt-1 text-sm text-secondary-content">Planned lessons across the course.</p>
								</div>
							</div>

							<div class="space-y-2">
								<div class="eyebrow-label tracking-[0.18em]">Live Now</div>
								<div>
									<div class="text-3xl font-bold text-primary-content">
										{{ availableModuleCount || moduleCount }}
									</div>
									<p class="mt-1 text-sm text-secondary-content">Start with the published path today.</p>
								</div>
							</div>

							<div class="space-y-2">
								<div class="eyebrow-label tracking-[0.18em]">Pace</div>
								<div>
									<div class="text-3xl font-bold text-primary-content">{{ totalDuration }}</div>
									<p class="mt-1 text-sm text-secondary-content">Structured for self-paced study.</p>
								</div>
							</div>

							<div class="space-y-2">
								<div class="eyebrow-label tracking-[0.18em]">Level</div>
								<div>
									<div class="text-3xl font-bold text-primary-content">{{ difficulty }}</div>
									<p class="mt-1 text-sm text-secondary-content">Real implementation detail, not fluff.</p>
								</div>
							</div>
						</div>

						<div
							v-if="learningPath.length > 0"
							class="border-t border-black/8 pt-6 dark:border-white/8"
						>
							<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
								<div class="max-w-2xl space-y-2">
									<div class="eyebrow-label">Learning Path</div>
									<p class="text-sm leading-7 text-secondary-content sm:text-base">
										The course follows a clear sequence so each module pays off in the next one.
									</p>
								</div>
								<p class="text-sm font-medium uppercase tracking-[0.2em] text-muted">
									{{ learningPath.length }} steps
								</p>
							</div>

							<div class="mt-5 grid gap-3 md:grid-cols-3">
								<div
									v-for="(step, index) in learningPath"
									:key="`${index}-${step}`"
									class="rounded-[1.25rem] border border-black/8 bg-white/35 px-4 py-4 dark:border-white/8 dark:bg-white/[0.03]"
								>
									<div class="text-sm font-semibold text-primary">0{{ index + 1 }}</div>
									<p class="mt-2 text-sm leading-6 text-primary-content">{{ step }}</p>
								</div>
							</div>
						</div>

						<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div class="flex flex-wrap items-center gap-3">
								<template v-for="author in authors" :key="author.name">
									<img
										v-if="author.avatarUrl"
										:src="author.avatarUrl"
										:alt="author.name"
										class="h-11 w-11 rounded-full object-cover ring-2 ring-primary/15"
										loading="lazy"
									/>
									<div
										v-else
										class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white"
									>
										{{ author.name.charAt(0) }}
									</div>
								</template>

								<div class="min-w-0">
									<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Taught by</p>
									<p class="text-base font-semibold text-primary-content">
										{{ authors.map((author) => author.name).join(", ") }}
									</p>
								</div>
							</div>

							<Button href="#course-content" variant="primary" size="lg" class="w-full sm:w-auto">
								Jump to the curriculum
							</Button>
						</div>
					</div>

					<aside class="glass-card-shimmer rounded-[1.75rem] p-6 xl:sticky xl:top-28">
						<div class="space-y-5">
							<div class="space-y-2">
								<div class="eyebrow-label">Course Updates</div>
								<h2 class="text-2xl font-bold text-primary-content">Follow along as new modules land</h2>
								<p class="text-sm leading-7 text-secondary-content">
									Sign up once and we’ll send the next lesson when it ships, along with relevant notes and source updates.
								</p>
							</div>

							<slot name="signup-form" />

							<div class="border-t surface-divider pt-5">
								<h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
									Included
								</h3>
								<ul class="mt-3 space-y-2 text-sm text-secondary-content">
									<li class="flex items-start gap-2">
										<span class="mt-1 text-primary">•</span>
										<span>Module release notifications for this course</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="mt-1 text-primary">•</span>
										<span>Source code, demos, and supporting material where available</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="mt-1 text-primary">•</span>
										<span>Builder-focused guidance without marketing noise</span>
									</li>
								</ul>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import Button from "../common/Button.vue";

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
