<script setup lang="ts">
import {
	computed,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";
import type { Testimonial } from "@/types/testimonial";

const AUTOPLAY_INTERVAL = 8000;

interface Props {
	testimonials: Testimonial[];
}

const props = defineProps<Props>();

const activeIndex = ref(0);
const progressKey = ref(0);
const isManuallyPaused = ref(false);
const testimonialCount = computed(() => props.testimonials.length);
const hasMultiple = computed(() => testimonialCount.value > 1);
const autoplayDuration = `${AUTOPLAY_INTERVAL}ms`;

const activeTestimonial = computed(() => {
	if (!testimonialCount.value) return null;
	return props.testimonials[activeIndex.value];
});

let autoplayTimer: ReturnType<typeof setInterval> | null = null;

const clearAutoplay = () => {
	if (autoplayTimer) {
		clearInterval(autoplayTimer);
		autoplayTimer = null;
	}
};

const startAutoplay = () => {
	clearAutoplay();
	if (!hasMultiple.value || isManuallyPaused.value) return;
	autoplayTimer = setInterval(() => {
		nextTestimonial();
	}, AUTOPLAY_INTERVAL);
};

watch(
	() => props.testimonials,
	(next) => {
		if (!next.length) {
			activeIndex.value = 0;
		} else if (activeIndex.value >= next.length) {
			activeIndex.value = 0;
		}
		startAutoplay();
	},
	{ deep: true }
);

watch(activeIndex, () => {
	progressKey.value += 1;
});

onMounted(() => {
	startAutoplay();
	progressKey.value += 1;
});

onBeforeUnmount(() => {
	clearAutoplay();
});

const setActiveIndex = (index: number) => {
	if (index < 0 || index >= testimonialCount.value) return;
	activeIndex.value = index;
};

const nextTestimonial = () => {
	if (!testimonialCount.value) return;
	activeIndex.value = (activeIndex.value + 1) % testimonialCount.value;
};

const prevTestimonial = () => {
	if (!testimonialCount.value) return;
	activeIndex.value =
		(activeIndex.value - 1 + testimonialCount.value) % testimonialCount.value;
};

const pauseAutoplay = () => {
	if (isManuallyPaused.value) return;
	isManuallyPaused.value = true;
	clearAutoplay();
};

const resumeAutoplay = () => {
	if (!isManuallyPaused.value) return;
	isManuallyPaused.value = false;
	startAutoplay();
};

const goNext = () => {
	pauseAutoplay();
	nextTestimonial();
	resumeAutoplay();
};

const goPrev = () => {
	pauseAutoplay();
	prevTestimonial();
	resumeAutoplay();
};

const formattedPosition = computed(() => {
	if (!testimonialCount.value) return "00 / 00";
	const current = `${activeIndex.value + 1}`.padStart(2, "0");
	const total = `${testimonialCount.value}`.padStart(2, "0");
	return `${current} / ${total}`;
});
</script>

<template>
	<div class="mt-8 md:mt-10 max-w-4xl mx-auto" v-if="activeTestimonial">
		<div
			class="relative group"
			@mouseenter="pauseAutoplay"
			@mouseleave="resumeAutoplay"
			@touchstart.passive="pauseAutoplay"
			@touchend.passive="resumeAutoplay"
			@touchcancel.passive="resumeAutoplay"
		>
			<!-- Previous Button (Desktop) -->
			<button
				v-if="hasMultiple"
				type="button"
				class="hidden md:grid absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-10 h-12 w-12 place-items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary hover:bg-white dark:hover:bg-gray-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				aria-label="Show previous testimonial"
				@click="goPrev"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6">
					<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<div class="w-full mx-auto">
				<Transition name="fade" mode="out-in">
					<article
						:key="`${activeTestimonial.author.name}-${activeIndex}`"
						class="relative rounded-3xl border border-gray-200/80 dark:border-gray-800/70 bg-white/95 dark:bg-gray-900/70 shadow-xl shadow-gray-200/70 dark:shadow-black/30 p-6 sm:p-10 overflow-hidden"
					>
						<!-- Progress Bar -->
						<div v-if="hasMultiple" class="absolute top-0 left-0 right-0 h-1 bg-gray-200/70 dark:bg-gray-800/70">
							<div
								:key="`progress-${progressKey}`"
								class="progress-fill h-full w-full origin-left bg-linear-to-r from-primary to-secondary"
								:class="{ 'is-paused': isManuallyPaused }"
								:style="{ '--testimonial-progress-duration': autoplayDuration }"
							></div>
						</div>

						<div class="flex flex-col items-center text-center">
							<p class="mt-4 text-xs uppercase tracking-[0.4em] text-primary/70 font-semibold">
								Featured Story
							</p>
							
							<blockquote class="mt-6" aria-live="polite">
								<p class="text-lg sm:text-2xl leading-relaxed text-gray-800 dark:text-gray-100 font-medium">
									&ldquo;{{ activeTestimonial.quote }}&rdquo;
								</p>
							</blockquote>

							<div class="mt-8 flex flex-col items-center gap-4">
								<div v-if="activeTestimonial.author.image" class="shrink-0">
									<img
										:src="activeTestimonial.author.image"
										:alt="`${activeTestimonial.author.name} profile picture`"
										class="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
										loading="lazy"
									/>
								</div>
								<div>
									<a
										v-if="activeTestimonial.author.link"
										:href="activeTestimonial.author.link"
										target="_blank"
										rel="noopener noreferrer"
										class="text-lg font-bold text-gray-900 dark:text-white hover:text-primary transition-colors"
									>
										{{ activeTestimonial.author.name }}
									</a>
									<p v-else class="text-lg font-bold text-gray-900 dark:text-white">
										{{ activeTestimonial.author.name }}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
										{{ activeTestimonial.author.title }}
									</p>
								</div>
							</div>
						</div>
					</article>
				</Transition>
			</div>

			<!-- Next Button (Desktop) -->
			<button
				v-if="hasMultiple"
				type="button"
				class="hidden md:grid absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-10 h-12 w-12 place-items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary hover:bg-white dark:hover:bg-gray-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				aria-label="Show next testimonial"
				@click="goNext"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6">
					<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<!-- Mobile Controls -->
			<div
				v-if="hasMultiple"
				class="md:hidden mt-6 flex items-center justify-center gap-6"
			>
				<button
					type="button"
					class="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 grid place-items-center hover:border-primary hover:text-primary shadow-sm"
					aria-label="Show previous testimonial"
					@click="goPrev"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
						<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
				
				<span class="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
					{{ formattedPosition }}
				</span>

				<button
					type="button"
					class="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 grid place-items-center hover:border-primary hover:text-primary shadow-sm"
					aria-label="Show next testimonial"
					@click="goNext"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
						<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>
	</div>
	<p v-else class="mt-6 text-center text-gray-500 dark:text-gray-400">
		No testimonials available just yet.
	</p>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 300ms ease, transform 300ms ease;
}

.fade-enter-from {
	opacity: 0;
	transform: translateY(10px) scale(0.98);
}

.fade-leave-to {
	opacity: 0;
	transform: translateY(-10px) scale(0.98);
}

.progress-fill {
	animation: testimonial-progress var(--testimonial-progress-duration, 8000ms)
		linear forwards;
}

.progress-fill.is-paused {
	animation-play-state: paused;
}

@keyframes testimonial-progress {
	from {
		transform: scaleX(0);
	}
	to {
		transform: scaleX(1);
	}
}

@media (prefers-reduced-motion: reduce) {
	.progress-fill {
		animation: none;
		transform: scaleX(1);
	}
	.fade-enter-active,
	.fade-leave-active {
		transition: none;
	}
}
</style>
