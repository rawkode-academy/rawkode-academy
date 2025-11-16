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
const isVoicePickerOpen = ref(false);
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

const selectVoice = (index: number) => {
	pauseAutoplay();
	setActiveIndex(index);
	resumeAutoplay();
};

const openVoicePicker = () => {
	isVoicePickerOpen.value = true;
	pauseAutoplay();
};

const closeVoicePicker = () => {
	isVoicePickerOpen.value = false;
	resumeAutoplay();
};

const selectVoiceFromPicker = (index: number) => {
	setActiveIndex(index);
	closeVoicePicker();
};

const formattedPosition = computed(() => {
	if (!testimonialCount.value) return "00 / 00";
	const current = `${activeIndex.value + 1}`.padStart(2, "0");
	const total = `${testimonialCount.value}`.padStart(2, "0");
	return `${current} / ${total}`;
});
</script>

<template>
	<div class="mt-10 md:mt-14" v-if="activeTestimonial">
		<div
			class="flex flex-col gap-10 md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start"
			@mouseenter="pauseAutoplay"
			@mouseleave="resumeAutoplay"
			@touchstart.passive="pauseAutoplay"
			@touchend.passive="resumeAutoplay"
			@touchcancel.passive="resumeAutoplay"
		>
			<div class="w-full max-w-xl mx-auto md:max-w-none">
				<Transition name="fade" mode="out-in">
					<article
						:key="`${activeTestimonial.author.name}-${activeIndex}`"
						class="rounded-3xl border border-gray-200/80 dark:border-gray-800/70 bg-white/95 dark:bg-gray-900/70 shadow-xl shadow-gray-200/70 dark:shadow-black/30 p-5 sm:p-8"
					>
						<div v-if="hasMultiple" class="mb-5 sm:mb-6">
							<div class="h-1 w-full rounded-full bg-gray-200/70 dark:bg-gray-800/70 overflow-hidden">
								<div
									:key="`progress-${progressKey}`"
									class="progress-fill h-full w-full origin-left bg-linear-to-r from-primary to-secondary"
									:class="{ 'is-paused': isManuallyPaused }"
									:style="{ '--testimonial-progress-duration': autoplayDuration }"
								></div>
							</div>
						</div>
						<p class="text-xs uppercase tracking-[0.4em] text-primary/70 font-semibold">
							Featured Story
						</p>
						<blockquote class="mt-3 sm:mt-4" aria-live="polite">
							<p class="text-base sm:text-xl leading-relaxed text-gray-800 dark:text-gray-100">
								&ldquo;{{ activeTestimonial.quote }}&rdquo;
							</p>
						</blockquote>
						<div class="mt-6 sm:mt-8 flex items-center gap-4">
							<div v-if="activeTestimonial.author.image" class="shrink-0">
								<img
									:src="activeTestimonial.author.image"
									:alt="`${activeTestimonial.author.name} profile picture`"
									class="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-primary/60 dark:border-primary/40"
									loading="lazy"
								/>
							</div>
							<div>
								<a
									v-if="activeTestimonial.author.link"
									:href="activeTestimonial.author.link"
									target="_blank"
									rel="noopener noreferrer"
									class="font-semibold text-gray-900 dark:text-white hover:text-primary transition-colors"
								>
									{{ activeTestimonial.author.name }}
								</a>
								<p v-else class="font-semibold text-gray-900 dark:text-white">
									{{ activeTestimonial.author.name }}
								</p>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									{{ activeTestimonial.author.title }}
								</p>
							</div>
						</div>
						<div
							v-if="hasMultiple"
							class="mt-8 sm:mt-10 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400"
						>
							<span>{{ formattedPosition }}</span>
							<div class="flex gap-2">
								<button
									type="button"
									class="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 grid place-items-center hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
									aria-label="Show previous testimonial"
									@click="goPrev"
								>
									<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4">
										<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</button>
								<button
									type="button"
									class="h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 grid place-items-center hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
									aria-label="Show next testimonial"
									@click="goNext"
								>
									<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4">
										<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</button>
							</div>
						</div>
					</article>
				</Transition>
				<div v-if="hasMultiple" class="md:hidden mt-6">
					<button
						type="button"
						class="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						@click="openVoicePicker"
					>
						<span>Browse other voices</span>
						<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
							<path d="M5 10h10M10 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>
			<div v-if="hasMultiple" class="hidden md:block">
				<p class="text-xs font-semibold tracking-[0.4em] uppercase text-gray-500 dark:text-gray-400">
					Voices
				</p>
				<ul class="mt-4 flex flex-col gap-3">
					<li v-for="(testimonial, index) in props.testimonials" :key="`desktop-selector-${index}`">
						<button
							type="button"
							class="w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center gap-3"
							:class="[
								activeIndex === index
									? 'border-primary/40 bg-primary/5 text-primary'
									: 'border-gray-200 bg-white/60 dark:bg-gray-900 dark:border-gray-800'
							]"
							@click="selectVoice(index)"
						>
							<div v-if="testimonial.author.image" class="shrink-0">
								<img
									:src="testimonial.author.image"
									:alt="`${testimonial.author.name} profile picture`"
									class="w-12 h-12 rounded-full object-cover"
									loading="lazy"
								/>
							</div>
							<div>
								<p class="font-semibold text-gray-900 dark:text-white">
									{{ testimonial.author.name }}
								</p>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									{{ testimonial.author.title }}
								</p>
							</div>
						</button>
					</li>
				</ul>
			</div>
		</div>
		<Transition name="fade">
			<div
				v-if="hasMultiple && isVoicePickerOpen"
				class="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
				role="dialog"
				aria-modal="true"
				aria-label="Choose a testimonial voice"
			>
				<div class="absolute inset-0 bg-gray-900/80" @click="closeVoicePicker"></div>
				<div
					class="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-gray-900 p-6 space-y-4 shadow-2xl"
				>
					<div class="flex items-center justify-between">
						<p class="text-base font-semibold text-gray-900 dark:text-white">Choose a voice</p>
						<button
							type="button"
							class="h-10 w-10 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							aria-label="Close voice picker"
							@click="closeVoicePicker"
						>
							<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4">
								<path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
					</div>
					<ul class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
						<li v-for="(testimonial, index) in props.testimonials" :key="`picker-${index}`">
							<button
								type="button"
								class="w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center gap-3"
								:class="[
									activeIndex === index
										? 'border-primary/40 bg-primary/5 text-primary'
										: 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800'
								]"
								@click="selectVoiceFromPicker(index)"
							>
								<div v-if="testimonial.author.image" class="shrink-0">
									<img
										:src="testimonial.author.image"
										:alt="`${testimonial.author.name} profile picture`"
										class="w-10 h-10 rounded-full object-cover"
										loading="lazy"
									/>
								</div>
								<div>
									<p class="font-semibold text-gray-900 dark:text-white">
										{{ testimonial.author.name }}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										{{ testimonial.author.title }}
									</p>
								</div>
							</button>
						</li>
					</ul>
				</div>
			</div>
		</Transition>
	</div>
	<p v-else class="mt-6 text-center text-gray-500 dark:text-gray-400">
		No testimonials available just yet.
	</p>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
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
}
</style>
