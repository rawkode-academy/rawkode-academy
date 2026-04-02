<script setup lang="ts">
import { css, cx } from "../../../styled-system/css";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

const navButtonClass = css({
	h: '12',
	w: '12',
	borderRadius: 'full',
	borderWidth: '1px',
	borderColor: { base: 'gray.200', _dark: 'gray.700' },
	display: 'grid',
	placeItems: 'center',
	transition: 'all',
	transitionDuration: '200ms',
	cursor: 'pointer',
	_hover: {
		borderColor: 'colorPalette.default',
		color: 'colorPalette.default',
	},
	_focusVisible: {
		outline: 'none',
		ringWidth: '2px',
		ringColor: 'colorPalette.default',
	},
});

const navIconSmClass = css({ h: '5', w: '5' });
const navIconLgClass = css({ h: '6', w: '6' });
</script>

<template>
	<div :class="css({ mt: '8', md: { mt: '10' }, maxW: '4xl', mx: 'auto' })" v-if="activeTestimonial">
		<div
			:class="css({ position: 'relative' })"
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
				:class="cx(
					navButtonClass,
					css({
						display: { base: 'none', md: 'grid' },
						position: 'absolute',
						left: '0',
						top: '50%',
						transform: 'translateY(-50%) translateX(-3rem)',
						zIndex: '10',
						bg: { base: 'white/50', _dark: 'gray.900/50' },
						color: { base: 'gray.400', _dark: 'gray.500' },
						_hover: {
							bg: { base: 'white', _dark: 'gray.900' },
						},
					}),
				)"
				aria-label="Show previous testimonial"
				@click="goPrev"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="navIconLgClass">
					<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<div :class="css({ w: 'full', mx: 'auto' })">
				<Transition name="fade" mode="out-in">
					<article
						:key="`${activeTestimonial.author.name}-${activeIndex}`"
						:class="css({
							position: 'relative',
							borderRadius: '3xl',
							borderWidth: '1px',
							borderColor: { base: 'gray.200/80', _dark: 'gray.800/70' },
							bg: { base: 'white/95', _dark: 'gray.900/70' },
							shadow: { base: '0 25px 50px -12px rgba(229,231,235,0.7)', _dark: '0 25px 50px -12px rgba(0,0,0,0.3)' },
							p: { base: '6', sm: '10' },
							overflow: 'hidden',
						})"
					>
						<!-- Progress Bar -->
						<div v-if="hasMultiple" :class="css({ position: 'absolute', top: '0', left: '0', right: '0', h: '1', bg: { base: 'gray.200/70', _dark: 'gray.800/70' } })">
							<div
								:key="`progress-${progressKey}`"
								:class="cx(
									'progress-fill',
									css({
										h: 'full',
										w: 'full',
										transformOrigin: 'left',
										backgroundImage: 'linear-gradient(to right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))',
									}),
									isManuallyPaused ? 'is-paused' : '',
								)"
								:style="{ '--testimonial-progress-duration': autoplayDuration }"
							></div>
						</div>

						<div :class="css({ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' })">
							<p :class="css({ mt: '4', fontSize: 'xs', textTransform: 'uppercase', letterSpacing: '0.4em', color: 'colorPalette.default/70', fontWeight: 'semibold' })">
								Featured Story
							</p>

							<blockquote :class="css({ mt: '6' })" aria-live="polite">
								<p :class="css({ fontSize: { base: 'lg', sm: '2xl' }, lineHeight: 'relaxed', color: { base: 'gray.800', _dark: 'gray.100' }, fontWeight: 'medium' })">
									&ldquo;{{ activeTestimonial.quote }}&rdquo;
								</p>
							</blockquote>

							<div :class="css({ mt: '8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4' })">
								<div v-if="activeTestimonial.author.image" :class="css({ flexShrink: '0' })">
									<img
										:src="activeTestimonial.author.image"
										:alt="`${activeTestimonial.author.name} profile picture`"
										:class="css({
											w: { base: '16', sm: '20' },
											h: { base: '16', sm: '20' },
											borderRadius: 'full',
											objectFit: 'cover',
											borderWidth: '4px',
											borderColor: { base: 'white', _dark: 'gray.800' },
											shadow: 'md',
										})"
										loading="lazy"
									/>
								</div>
								<div>
									<a
										v-if="activeTestimonial.author.link"
										:href="activeTestimonial.author.link"
										target="_blank"
										rel="noopener noreferrer"
										:class="cx('text-primary-content', css({ fontSize: 'lg', fontWeight: 'bold', _hover: { color: 'colorPalette.default' }, transition: 'colors', transitionDuration: '200ms' }))"
									>
										{{ activeTestimonial.author.name }}
									</a>
									<p v-else :class="cx('text-primary-content', css({ fontSize: 'lg', fontWeight: 'bold' }))">
										{{ activeTestimonial.author.name }}
									</p>
									<p :class="cx('text-muted', css({ fontSize: 'sm', fontWeight: 'medium', mt: '1' }))">
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
				:class="cx(
					navButtonClass,
					css({
						display: { base: 'none', md: 'grid' },
						position: 'absolute',
						right: '0',
						top: '50%',
						transform: 'translateY(-50%) translateX(3rem)',
						zIndex: '10',
						bg: { base: 'white/50', _dark: 'gray.900/50' },
						color: { base: 'gray.400', _dark: 'gray.500' },
						_hover: {
							bg: { base: 'white', _dark: 'gray.900' },
						},
					}),
				)"
				aria-label="Show next testimonial"
				@click="goNext"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="navIconLgClass">
					<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<!-- Mobile Controls -->
			<div
				v-if="hasMultiple"
				:class="css({ display: { base: 'flex', md: 'none' }, mt: '6', alignItems: 'center', justifyContent: 'center', gap: '6' })"
			>
				<button
					type="button"
					:class="cx(
						navButtonClass,
						css({
							bg: { base: 'white', _dark: 'gray.800' },
							color: { base: 'gray.400', _dark: 'gray.500' },
							shadow: 'sm',
						}),
					)"
					aria-label="Show previous testimonial"
					@click="goPrev"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="navIconSmClass">
						<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>

				<span :class="cx('text-muted', css({ fontSize: 'sm', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' }))">
					{{ formattedPosition }}
				</span>

				<button
					type="button"
					:class="cx(
						navButtonClass,
						css({
							bg: { base: 'white', _dark: 'gray.800' },
							color: { base: 'gray.400', _dark: 'gray.500' },
							shadow: 'sm',
						}),
					)"
					aria-label="Show next testimonial"
					@click="goNext"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="navIconSmClass">
						<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>
	</div>
	<p v-else :class="cx('text-muted', css({ mt: '6', textAlign: 'center' }))">
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
