<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import type { Round } from "@/lib/games/guess-the-logo";
import { TIMER_SECONDS } from "@/lib/games/guess-the-logo";
import LogoScanline from "./LogoScanline.vue";

const props = defineProps<{
	round: Round;
	index: number;
	total: number;
	revealed: boolean;
}>();

const emit = defineEmits<{
	answer: [name: string | null];
}>();

const timeLeft = ref(TIMER_SECONDS);
const playerAnswer = ref<string | null | undefined>(undefined); // undefined = not yet answered
let timerId: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
	if (timerId !== null) {
		clearInterval(timerId);
		timerId = null;
	}
}

function startTimer() {
	clearTimer();
	timeLeft.value = TIMER_SECONDS;
	timerId = setInterval(() => {
		timeLeft.value -= 1;
		if (timeLeft.value <= 0) {
			clearTimer();
			if (playerAnswer.value === undefined) {
				playerAnswer.value = null;
				emit("answer", null);
			}
		}
	}, 1000);
}

function handleOptionClick(option: string) {
	if (playerAnswer.value !== undefined) return; // already answered
	clearTimer();
	playerAnswer.value = option;
	emit("answer", option);
}

function optionClass(option: string): string {
	if (!props.revealed || playerAnswer.value === undefined) {
		return "gtl-option";
	}
	if (option === props.round.answer) {
		return "gtl-option gtl-option--correct";
	}
	if (option === playerAnswer.value && option !== props.round.answer) {
		return "gtl-option gtl-option--wrong";
	}
	return "gtl-option gtl-option--neutral";
}

const timerPercent = computed(() => (timeLeft.value / TIMER_SECONDS) * 100);

const timerColor = computed(() => {
	if (timeLeft.value > TIMER_SECONDS * 0.5) return "#00ceff";
	if (timeLeft.value > TIMER_SECONDS * 0.25) return "#f59e0b";
	return "#ef4444";
});

// Reset and restart timer when the round changes (index changes)
watch(
	() => props.index,
	() => {
		playerAnswer.value = undefined;
		startTimer();
	},
);

// Stop timer when revealed (answer already locked in)
watch(
	() => props.revealed,
	(isRevealed) => {
		if (isRevealed) {
			clearTimer();
		}
	},
);

onMounted(() => {
	startTimer();
});

onUnmounted(() => {
	clearTimer();
});
</script>

<template>
	<div class="gtl-round">
		<!-- Round counter -->
		<div class="gtl-round-header">
			<span class="gtl-round-label">Logo {{ index + 1 }} of {{ total }}</span>
			<span class="gtl-timer-label" :style="{ color: timerColor }">{{ timeLeft }}s</span>
		</div>

		<!-- Timer bar -->
		<div class="gtl-timer-track" role="progressbar" :aria-valuenow="timeLeft" :aria-valuemax="TIMER_SECONDS" aria-label="Time remaining">
			<div
				class="gtl-timer-bar"
				:style="{ width: `${timerPercent}%`, background: timerColor }"
			></div>
		</div>

		<!-- Logo -->
		<div class="gtl-logo-wrap">
			<LogoScanline :icon-url="round.logo.iconUrl" :revealed="revealed" />
		</div>

		<!-- Options -->
		<div class="gtl-options" role="group" aria-label="Answer options">
			<button
				v-for="option in round.options"
				:key="option"
				:class="optionClass(option)"
				:disabled="playerAnswer !== undefined || revealed"
				:aria-pressed="playerAnswer === option"
				@click="handleOptionClick(option)"
			>
				{{ option }}
			</button>
		</div>

		<!-- Reveal feedback -->
		<div v-if="revealed" class="gtl-reveal-msg" aria-live="polite">
			<template v-if="playerAnswer === null">
				<span class="gtl-reveal-timeout">Time's up! The answer was <strong>{{ round.answer }}</strong>.</span>
			</template>
			<template v-else-if="playerAnswer === round.answer">
				<span class="gtl-reveal-correct">Correct!</span>
			</template>
			<template v-else>
				<span class="gtl-reveal-wrong">Incorrect. The answer was <strong>{{ round.answer }}</strong>.</span>
			</template>
		</div>
	</div>
</template>

<style scoped>
.gtl-round {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
	width: 100%;
	max-width: 36rem;
	margin: 0 auto;
}

.gtl-round-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.gtl-round-label {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.75rem;
	font-weight: 600;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

.gtl-timer-label {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.875rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	transition: color 300ms ease;
}

.gtl-timer-track {
	width: 100%;
	height: 4px;
	background: var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	border-radius: 2px;
	overflow: hidden;
}

.gtl-timer-bar {
	height: 100%;
	border-radius: 2px;
	transition: width 1s linear, background 300ms ease;
}

@media (prefers-reduced-motion: reduce) {
	.gtl-timer-bar {
		transition: background 300ms ease;
	}
}

.gtl-logo-wrap {
	width: 100%;
	max-width: 20rem;
	margin: 0 auto;
}

.gtl-options {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.75rem;
}

.gtl-option {
	padding: 0.75rem 1rem;
	border-radius: 0.5rem;
	border: 1px solid var(--editorial-hairline, oklch(0.18 0.02 60 / 0.12));
	background: var(--surface-card, oklch(0.97 0.008 85));
	color: var(--editorial-ink, oklch(0.18 0.02 60));
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 0.9rem;
	font-weight: 500;
	cursor: pointer;
	text-align: left;
	transition: border-color 150ms ease, background 150ms ease;
	line-height: 1.3;
}

.gtl-option:hover:not(:disabled) {
	border-color: #00ceff;
	background: color-mix(in srgb, #00ceff 8%, var(--surface-card, oklch(0.97 0.008 85)));
}

.gtl-option:disabled {
	cursor: default;
}

.gtl-option--correct {
	border-color: #22c55e;
	background: color-mix(in srgb, #22c55e 12%, var(--surface-card, oklch(0.97 0.008 85)));
	color: #16a34a;
}

.gtl-option--wrong {
	border-color: #ef4444;
	background: color-mix(in srgb, #ef4444 12%, var(--surface-card, oklch(0.97 0.008 85)));
	color: #dc2626;
}

.gtl-option--neutral {
	opacity: 0.55;
}

.gtl-reveal-msg {
	min-height: 1.5rem;
	font-size: 0.9rem;
	text-align: center;
}

.gtl-reveal-correct {
	color: #16a34a;
	font-weight: 600;
}

.gtl-reveal-wrong {
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}

.gtl-reveal-timeout {
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
}
</style>
