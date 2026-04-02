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
	<section class="relative page-px section-py">
		<div class="pointer-events-none absolute inset-0 flex justify-center">
			<div class="h-full w-3/4 max-w-5xl rounded-full bg-gradient-to-r from-primary/20 via-white/40 to-secondary/20 blur-[160px] opacity-30 dark:from-primary/40 dark:via-gray-900/40 dark:to-secondary/40"></div>
		</div>
		<div class="glass-panel relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-5 py-10 sm:px-8 lg:px-10 xl:px-12">
			<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(var(--brand-primary),0.14),_transparent_34%),radial-gradient(circle_at_85%_10%,_rgba(var(--brand-secondary),0.12),_transparent_28%)] opacity-90" />
			<div class="relative mx-auto mb-10 max-w-3xl text-center lg:mb-14">
				<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-900/60">
					<span class="h-2 w-2 rounded-full bg-primary"></span>
					How Rawkode Teaches
				</div>
				<h2 class="mb-4 text-3xl font-bold tracking-tight text-primary-content md:text-4xl">
					{{ title }}
				</h2>
				<p class="mx-auto max-w-[52ch] text-base leading-7 text-secondary-content sm:text-lg sm:leading-8">
					{{ description }}
				</p>
			</div>
			<div class="relative grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5">
				<div
					v-for="(item, index) in segments"
					:key="item.title"
					class="group glass-card relative flex h-full flex-col overflow-hidden rounded-[1.5rem] p-6 motion-safe:transition-all motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/35 motion-safe:hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)] sm:p-7"
				>
					<div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/15"></div>
					<div class="flex items-start justify-between gap-4">
						<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary/15 to-secondary/15 shadow-inner shadow-white/30 dark:from-primary/25 dark:to-secondary/25">
							<span class="text-2xl">{{ item.emoji || "😼" }}</span>
						</div>
						<span class="pt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">
							{{ String(index + 1).padStart(2, "0") }}
						</span>
					</div>
						<div class="mt-5 flex flex-1 flex-col justify-between gap-4">
							<div class="space-y-3">
								<h3 class="max-w-[16ch] text-balance text-xl font-semibold tracking-tight text-primary-content">
									{{ item.title }}
								</h3>
							<p class="max-w-[34ch] text-sm leading-7 text-secondary-content sm:text-base">
								{{ item.description }}
							</p>
						</div>
						<div class="h-px w-12 rounded-full bg-gradient-to-r from-primary/45 to-secondary/45 opacity-70"></div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
