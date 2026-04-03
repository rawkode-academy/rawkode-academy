<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Testimonial } from "@/types/testimonial";

const AUTOPLAY_INTERVAL = 8000;

interface Props {
	testimonials: Testimonial[];
}

const props = defineProps<Props>();

const activeIndex = ref(0);
const progressKey = ref(0);
const isUserPaused = ref(false);
const isInteractionPaused = ref(false);
const testimonialCount = computed(() => props.testimonials.length);
const hasMultiple = computed(() => testimonialCount.value > 1);
const isPaused = computed(
	() => isUserPaused.value || isInteractionPaused.value,
);
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
	if (!hasMultiple.value || isPaused.value) return;
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
	{ deep: true },
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

const nextTestimonial = () => {
	if (!testimonialCount.value) return;
	activeIndex.value = (activeIndex.value + 1) % testimonialCount.value;
};

const prevTestimonial = () => {
	if (!testimonialCount.value) return;
	activeIndex.value =
		(activeIndex.value - 1 + testimonialCount.value) % testimonialCount.value;
};

const pauseForInteraction = () => {
	if (isInteractionPaused.value) return;
	isInteractionPaused.value = true;
	clearAutoplay();
};

const resumeAfterInteraction = () => {
	if (!isInteractionPaused.value) return;
	isInteractionPaused.value = false;
	startAutoplay();
};

const toggleAutoplay = () => {
	isUserPaused.value = !isUserPaused.value;
	startAutoplay();
};

const handleFocusOut = (event: FocusEvent) => {
	const currentTarget = event.currentTarget as HTMLElement | null;
	const nextTarget = event.relatedTarget as Node | null;
	if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
		return;
	}
	resumeAfterInteraction();
};

const goNext = () => {
	nextTestimonial();
};

const goPrev = () => {
	prevTestimonial();
};

const formattedPosition = computed(() => {
	if (!testimonialCount.value) return "00 / 00";
	const current = `${activeIndex.value + 1}`.padStart(2, "0");
	const total = `${testimonialCount.value}`.padStart(2, "0");
	return `${current} / ${total}`;
});
</script>

<template>
	<div class="mx-auto mt-8 max-w-4xl md:mt-10" v-if="activeTestimonial">
		<div
			class="relative group"
			@mouseenter="pauseForInteraction"
			@mouseleave="resumeAfterInteraction"
			@focusin="pauseForInteraction"
			@focusout="handleFocusOut"
			@touchstart.passive="pauseForInteraction"
			@touchend.passive="resumeAfterInteraction"
			@touchcancel.passive="resumeAfterInteraction"
		>
			<div class="w-full mx-auto">
				<Transition name="fade" mode="out-in">
					<article
						:key="`${activeTestimonial.author.name}-${activeIndex}`"
						class="glass-card-shimmer relative overflow-hidden rounded-[2rem] p-5 sm:p-6 lg:px-8 lg:py-7"
					>
						<div v-if="hasMultiple" class="absolute left-0 right-0 top-0 h-1 bg-white/60 dark:bg-white/10">
							<div
								:key="`progress-${progressKey}`"
								class="progress-fill h-full w-full origin-left bg-linear-to-r from-primary to-secondary"
								:class="{ 'is-paused': isPaused }"
								:style="{ '--testimonial-progress-duration': autoplayDuration }"
							></div>
						</div>

						<div class="relative flex flex-col items-center text-center md:grid md:grid-cols-[minmax(0,1fr)_12rem] md:items-end md:gap-8 md:text-left">
							<blockquote class="w-full">
								<p class="text-pretty text-base font-medium leading-7 text-primary-content sm:text-[1.05rem] sm:leading-[1.65] lg:text-[1.16rem] lg:leading-[1.58]">
									&ldquo;{{ activeTestimonial.quote }}&rdquo;
								</p>
							</blockquote>

							<div class="mt-5 w-full border-t border-white/45 pt-4 dark:border-white/10 md:mt-0 md:max-w-[12rem] md:border-l md:border-t-0 md:pl-6 md:pt-0">
								<div class="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
									<div v-if="activeTestimonial.author.image" class="shrink-0">
										<img
											:src="activeTestimonial.author.image"
											:alt="`${activeTestimonial.author.name} profile picture`"
											class="h-16 w-16 rounded-full border-4 border-white object-cover shadow-md dark:border-gray-800 sm:h-[4.5rem] sm:w-[4.5rem]"
											loading="lazy"
										/>
									</div>
									<div class="space-y-1">
										<a
											v-if="activeTestimonial.author.link"
											:href="activeTestimonial.author.link"
											target="_blank"
											rel="noopener noreferrer"
											class="text-lg font-bold text-primary-content transition-colors hover:text-primary"
										>
											{{ activeTestimonial.author.name }}
										</a>
										<p v-else class="text-lg font-bold text-primary-content">
											{{ activeTestimonial.author.name }}
										</p>
										<p
											v-if="activeTestimonial.author.title"
											class="text-sm font-medium text-muted"
										>
											{{ activeTestimonial.author.title }}
										</p>
									</div>
								</div>
							</div>
						</div>
					</article>
				</Transition>
			</div>

			<div
				v-if="hasMultiple"
				class="mt-5 flex justify-center"
			>
				<div class="glass-card inline-flex min-h-12 items-center gap-1 rounded-full px-2 py-2 shadow-sm">
					<button
						type="button"
						class="grid h-10 w-10 place-items-center rounded-full text-muted motion-safe:transition-colors motion-safe:duration-200 hover:bg-white/55 hover:text-primary dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						aria-label="Show previous testimonial"
						@click="goPrev"
					>
						<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
							<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>

					<span class="min-w-[4.75rem] px-2 text-center text-sm font-medium text-muted tabular-nums">
						{{ formattedPosition }}
					</span>

					<button
						type="button"
						class="grid h-10 w-10 place-items-center rounded-full text-muted motion-safe:transition-colors motion-safe:duration-200 hover:bg-white/55 hover:text-primary dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						:aria-label="isPaused ? 'Resume testimonial autoplay' : 'Pause testimonial autoplay'"
						:aria-pressed="isPaused"
						@click="toggleAutoplay"
					>
						<svg
							v-if="isPaused"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
						>
							<path
								d="M8 6l6 4-6 4V6z"
								fill="currentColor"
								stroke="currentColor"
								stroke-linejoin="round"
							/>
						</svg>
						<svg
							v-else
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
						>
							<path
								d="M7 5.5v9M13 5.5v9"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
					</button>

					<button
						type="button"
						class="grid h-10 w-10 place-items-center rounded-full text-muted motion-safe:transition-colors motion-safe:duration-200 hover:bg-white/55 hover:text-primary dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
	</div>
	<p v-else class="mt-6 text-center text-muted">
		No testimonials available just yet.
	</p>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition:
		opacity 300ms cubic-bezier(0.22, 1, 0.36, 1),
		transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
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
