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
	<section class="relative page-px section-py-tight">
		<div class="pointer-events-none absolute inset-0 flex justify-center">
			<div class="h-full w-full max-w-6xl bg-[radial-gradient(circle_at_0%_12%,_rgba(var(--brand-primary),0.1),_transparent_32%),radial-gradient(circle_at_100%_72%,_rgba(var(--brand-secondary),0.08),_transparent_28%)] dark:bg-[radial-gradient(circle_at_0%_12%,_rgba(var(--brand-primary),0.14),_transparent_32%),radial-gradient(circle_at_100%_72%,_rgba(var(--brand-secondary),0.1),_transparent_28%)]"></div>
		</div>
		<div class="relative mx-auto max-w-7xl">
			<div class="grid gap-10 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-start xl:gap-12">
				<div class="space-y-5 xl:sticky xl:top-28">
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-primary"></span>
						<span class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary">
							How Rawkode Teaches
						</span>
					</div>
					<h2 class="max-w-[18ch] text-balance text-3xl font-bold tracking-tight text-primary-content md:text-4xl lg:max-w-none">
						{{ title }}
					</h2>
					<p class="max-w-[38ch] text-base leading-7 text-secondary-content sm:text-lg sm:leading-8">
						{{ description }}
					</p>
				</div>

				<ol class="grid gap-x-8 gap-y-10 md:grid-cols-2 md:gap-y-12">
					<li
						v-for="(item, index) in segments"
						:key="item.title"
						:class="[
							'group relative min-w-0 pt-10',
							index % 2 === 1 && 'md:pt-16 xl:pt-20',
						]"
					>
						<div class="pointer-events-none absolute left-0 top-0 text-[4.75rem] font-semibold leading-none tracking-[-0.09em] text-primary/10 dark:text-primary/12">
							{{ String(index + 1).padStart(2, "0") }}
						</div>
						<div class="relative space-y-4">
							<div class="flex items-center gap-4">
								<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[1.35rem] ring-1 ring-black/5 dark:bg-primary/18 dark:ring-white/8">
									<span>{{ item.emoji || "😼" }}</span>
								</div>
								<div class="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted">
									{{ String(index + 1).padStart(2, "0") }}
								</div>
							</div>
							<div class="space-y-3">
								<h3 class="min-w-0 max-w-[16ch] text-balance text-2xl font-semibold leading-[1.05] tracking-[-0.045em] text-primary-content transition-colors duration-200 group-hover:text-primary">
									{{ item.title }}
								</h3>
								<p class="max-w-[34ch] text-base leading-8 text-secondary-content">
									{{ item.description }}
								</p>
							</div>
						</div>
					</li>
				</ol>
			</div>
		</div>
	</section>
	</template>
