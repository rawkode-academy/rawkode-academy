<script setup lang="ts">
import { css } from "../../../styled-system/css";
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

const navBtnStyle = css({
	display: { base: "none", md: "grid" },
	position: "absolute",
	top: "50%",
	transform: "translateY(-50%)",
	zIndex: 10,
	h: "12",
	w: "12",
	placeItems: "center",
	rounded: "full",
	border: "1px solid",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	bg: { base: "rgba(255,255,255,0.5)", _dark: "rgba(17,24,39,0.5)" },
	color: { base: "gray.500", _dark: "gray.400" },
	transition: "all",
	transitionDuration: "200ms",
	cursor: "pointer",
	_hover: {
		borderColor: "rgb(var(--brand-primary))",
		color: "rgb(var(--brand-primary))",
		bg: { base: "white", _dark: "gray.900" },
	},
	_focusVisible: {
		outline: "none",
		ring: "2px solid",
		ringColor: "rgb(var(--brand-primary))",
	},
});

const mobileNavBtnStyle = css({
	h: "12",
	w: "12",
	rounded: "full",
	border: "1px solid",
	borderColor: { base: "gray.200", _dark: "gray.700" },
	bg: { base: "white", _dark: "gray.800" },
	color: { base: "gray.500", _dark: "gray.400" },
	display: "grid",
	placeItems: "center",
	shadow: "sm",
	cursor: "pointer",
	_hover: {
		borderColor: "rgb(var(--brand-primary))",
		color: "rgb(var(--brand-primary))",
	},
});
</script>

<template>
	<div :class="css({ mt: { base: '8', md: '10' }, maxW: '4xl', mx: 'auto' })" v-if="activeTestimonial">
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
				:class="[navBtnStyle, css({ left: '0', transform: 'translateY(-50%) translateX(-3rem)' })]"
				aria-label="Show previous testimonial"
				@click="goPrev"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="css({ h: '6', w: '6' })">
					<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<div :class="css({ w: 'full', mx: 'auto' })">
				<Transition name="fade" mode="out-in">
					<article
						:key="`${activeTestimonial.author.name}-${activeIndex}`"
						:class="css({ position: 'relative', rounded: '3xl', border: '1px solid', borderColor: { base: 'rgba(229,231,235,0.8)', _dark: 'rgba(31,41,55,0.7)' }, bg: { base: 'rgba(255,255,255,0.95)', _dark: 'rgba(17,24,39,0.7)' }, shadow: 'xl', p: { base: '6', sm: '10' }, overflow: 'hidden' })"
					>
						<!-- Progress Bar -->
						<div v-if="hasMultiple" :class="css({ position: 'absolute', top: '0', left: '0', right: '0', h: '1', bg: { base: 'rgba(229,231,235,0.7)', _dark: 'rgba(31,41,55,0.7)' } })">
							<div
								:key="`progress-${progressKey}`"
								class="progress-fill"
								:class="[css({ h: 'full', w: 'full', transformOrigin: 'left', background: 'linear-gradient(to right, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))' }), { 'is-paused': isManuallyPaused }]"
								:style="{ '--testimonial-progress-duration': autoplayDuration }"
							></div>
						</div>

						<div :class="css({ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' })">
							<p :class="css({ mt: '4', fontSize: 'xs', textTransform: 'uppercase', letterSpacing: '0.4em', color: 'rgba(var(--brand-primary),0.7)', fontWeight: 'semibold' })">
								Featured Story
							</p>

							<blockquote :class="css({ mt: '6' })" aria-live="polite">
								<p :class="css({ fontSize: { base: 'lg', sm: '2xl' }, lineHeight: 'relaxed', color: { base: 'gray.800', _dark: 'gray.100' }, fontWeight: 'medium' })">
									&ldquo;{{ activeTestimonial.quote }}&rdquo;
								</p>
							</blockquote>

							<div :class="css({ mt: '8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4' })">
								<div v-if="activeTestimonial.author.image" :class="css({ flexShrink: 0 })">
									<img
										:src="activeTestimonial.author.image"
										:alt="`${activeTestimonial.author.name} profile picture`"
										:class="css({ w: { base: '16', sm: '20' }, h: { base: '16', sm: '20' }, rounded: 'full', objectFit: 'cover', border: '4px solid', borderColor: { base: 'white', _dark: 'gray.800' }, shadow: 'md' })"
										loading="lazy"
									/>
								</div>
								<div>
									<a
										v-if="activeTestimonial.author.link"
										:href="activeTestimonial.author.link"
										target="_blank"
										rel="noopener noreferrer"
										:class="css({ fontSize: 'lg', fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' }, transition: 'colors', transitionDuration: '200ms', _hover: { color: 'rgb(var(--brand-primary))' } })"
									>
										{{ activeTestimonial.author.name }}
									</a>
									<p v-else :class="css({ fontSize: 'lg', fontWeight: 'bold', color: { base: 'gray.900', _dark: 'white' } })">
										{{ activeTestimonial.author.name }}
									</p>
									<p :class="css({ fontSize: 'sm', color: { base: 'gray.500', _dark: 'gray.400' }, fontWeight: 'medium', mt: '1' })">
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
				:class="[navBtnStyle, css({ right: '0', transform: 'translateY(-50%) translateX(3rem)' })]"
				aria-label="Show next testimonial"
				@click="goNext"
			>
				<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="css({ h: '6', w: '6' })">
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
					:class="mobileNavBtnStyle"
					aria-label="Show previous testimonial"
					@click="goPrev"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="css({ h: '5', w: '5' })">
						<path d="M12 5l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>

				<span :class="css({ fontSize: 'sm', fontWeight: 'medium', color: { base: 'gray.500', _dark: 'gray.400' }, fontVariantNumeric: 'tabular-nums' })">
					{{ formattedPosition }}
				</span>

				<button
					type="button"
					:class="mobileNavBtnStyle"
					aria-label="Show next testimonial"
					@click="goNext"
				>
					<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" :class="css({ h: '5', w: '5' })">
						<path d="M8 5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</div>
		</div>
	</div>
	<p v-else :class="css({ mt: '6', textAlign: 'center', color: { base: 'gray.500', _dark: 'gray.400' } })">
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
