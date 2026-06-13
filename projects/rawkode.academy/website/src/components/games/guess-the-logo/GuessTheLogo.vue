<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { Round } from "@/lib/games/guess-the-logo";
import { scoreGame } from "@/lib/games/guess-the-logo";
import { ACHIEVEMENTS, evaluateAchievements } from "@/lib/games/guess-the-logo-achievements";
import {
	getStatus,
	submitScore,
	unlockAchievements,
	getLeaderboard,
	getAchievements,
	type LeaderboardEntry,
} from "@/lib/games/guess-the-logo-api";
import RoundView from "./RoundView.vue";
import ResultsView from "./ResultsView.vue";

const props = defineProps<{
	rounds: Round[];
	date: string;
	playerName: string | null;
	disableAuth: boolean;
}>();

type GameState = "loading" | "intro" | "playing" | "results";

const state = ref<GameState>("loading");
const currentIndex = ref(0);
const answers = ref<(string | null)[]>([]);
const revealed = ref(false);

// Results data
const finalScore = ref(0);
const earnedIds = ref<string[]>([]);
const newlyUnlocked = ref<string[]>([]);
const leaderboard = ref<LeaderboardEntry[]>([]);
const playerRank = ref<number | null>(null);
const alreadyPlayed = ref(false);
const playerAchievements = ref<{ achievementId: string; unlockedAt: string }[]>([]);

// Intro date formatting
function formatDateDisplay(dateStr: string): string {
	const [year, month, day] = dateStr.split("-").map(Number);
	const d = new Date(Date.UTC(year, month - 1, day));
	return d.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

async function loadResultsData(existingScore: number | null = null, existingRank: number | null = null) {
	const [lb, achs] = await Promise.all([
		getLeaderboard(10).catch(() => [] as LeaderboardEntry[]),
		getAchievements().catch(() => [] as { achievementId: string; unlockedAt: string }[]),
	]);
	leaderboard.value = lb;
	playerAchievements.value = achs;

	// Build earnedIds from stored achievements
	earnedIds.value = achs.map((a) => a.achievementId);
	playerRank.value = existingRank;

	if (existingScore !== null) {
		finalScore.value = existingScore;
	}
}

onMounted(async () => {
	if (!props.disableAuth) {
		try {
			const status = await getStatus();
			if (status.alreadyPlayed) {
				alreadyPlayed.value = true;
				finalScore.value = status.score ?? 0;
				playerRank.value = status.rank;
				await loadResultsData(status.score, status.rank);
				state.value = "results";
				return;
			}
		} catch {
			// If status check fails (e.g. network), proceed to intro
		}
	}
	state.value = "intro";
});

function startGame() {
	currentIndex.value = 0;
	answers.value = [];
	revealed.value = false;
	state.value = "playing";
}

async function handleAnswer(name: string | null) {
	// Record answer for current round
	const idx = currentIndex.value;
	const newAnswers = [...answers.value];
	newAnswers[idx] = name;
	answers.value = newAnswers;

	// Reveal the logo
	revealed.value = true;

	// Wait ~900ms then advance
	await new Promise<void>((resolve) => setTimeout(resolve, 900));

	if (idx + 1 < props.rounds.length) {
		currentIndex.value = idx + 1;
		revealed.value = false;
	} else {
		// All rounds done — compute results
		await finishGame(newAnswers);
	}
}

async function finishGame(finalAnswers: (string | null)[]) {
	const score = scoreGame(finalAnswers, props.rounds);
	const earned = evaluateAchievements(props.rounds, finalAnswers);

	finalScore.value = score;
	earnedIds.value = earned;
	alreadyPlayed.value = false;

	if (!props.disableAuth) {
		try {
			// Submit score (onlyIfAbsent server-side)
			const scoreResult = await submitScore(score);
			playerRank.value = scoreResult.rank;
		} catch {
			playerRank.value = null;
		}

		try {
			// Unlock earned achievements
			const unlockResult = await unlockAchievements(earned);
			newlyUnlocked.value = unlockResult.unlocked;
		} catch {
			newlyUnlocked.value = [];
		}

		// Load fresh leaderboard + all achievements
		await loadResultsData(score, playerRank.value);
	} else {
		// Dev/no-auth path: show score without server calls
		newlyUnlocked.value = earned;
		leaderboard.value = [];
	}

	state.value = "results";
}
</script>

<template>
	<div class="gtl-root">
		<!-- Loading -->
		<div v-if="state === 'loading'" class="gtl-center" aria-live="polite" aria-label="Loading">
			<div class="gtl-spinner" aria-hidden="true"></div>
			<p class="gtl-loading-text">Loading today's puzzle...</p>
		</div>

		<!-- Intro -->
		<div v-else-if="state === 'intro'" class="gtl-intro gtl-center">
			<p class="gtl-intro-eyebrow">Daily Challenge</p>
			<h1 class="gtl-intro-title">Guess the Logo</h1>
			<p class="gtl-intro-date">{{ formatDateDisplay(date) }}</p>
			<p class="gtl-intro-desc">
				10 CNCF technology logos. 4 options each. 15 seconds per logo.
				<br />How many can you identify?
			</p>
			<button class="gtl-start-btn" @click="startGame">Start</button>
		</div>

		<!-- Playing -->
		<Transition v-else-if="state === 'playing'" name="gtl-fade" mode="out-in">
			<RoundView
				:key="currentIndex"
				:round="rounds[currentIndex]"
				:index="currentIndex"
				:total="rounds.length"
				:revealed="revealed"
				@answer="handleAnswer"
			/>
		</Transition>

		<!-- Results -->
		<ResultsView
			v-else-if="state === 'results'"
			:score="finalScore"
			:total="rounds.length"
			:earned-ids="earnedIds"
			:newly-unlocked="newlyUnlocked"
			:achievements="ACHIEVEMENTS"
			:leaderboard="leaderboard"
			:rank="playerRank"
			:already-played="alreadyPlayed"
			:date="date"
		/>
	</div>
</template>

<style scoped>
.gtl-root {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	padding: 2rem 1rem;
}

.gtl-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
	text-align: center;
	gap: 1.25rem;
}

/* Spinner */
.gtl-spinner {
	width: 2.5rem;
	height: 2.5rem;
	border: 2px solid color-mix(in srgb, #00ceff 20%, transparent);
	border-top-color: #00ceff;
	border-radius: 50%;
	animation: gtl-spin 0.8s linear infinite;
}

@keyframes gtl-spin {
	to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
	.gtl-spinner {
		animation: none;
		border-color: #00ceff;
	}
}

.gtl-loading-text {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.8rem;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--editorial-ink-mute, oklch(0.58 0.012 60));
}

/* Intro */
.gtl-intro-eyebrow {
	font-family: var(--font-jetbrains-mono, monospace);
	font-size: 0.7rem;
	font-weight: 600;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	color: #00ceff;
	margin: 0;
}

.gtl-intro-title {
	font-family: var(--font-instrument-serif, serif);
	font-style: italic;
	font-size: 3rem;
	font-weight: 400;
	letter-spacing: -0.03em;
	color: var(--editorial-ink, oklch(0.18 0.02 60));
	margin: 0;
	background: linear-gradient(135deg, #5f5ed7, #00ceff);
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: transparent;
}

.gtl-intro-date {
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 0.9rem;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
	margin: 0;
}

.gtl-intro-desc {
	font-size: 0.95rem;
	line-height: 1.6;
	color: var(--editorial-ink-soft, oklch(0.36 0.015 60));
	max-width: 30rem;
	margin: 0;
}

.gtl-start-btn {
	padding: 0.875rem 3rem;
	border-radius: 0.5rem;
	border: none;
	background: linear-gradient(135deg, #5f5ed7, #00ceff);
	color: #fff;
	font-family: var(--font-inter-tight, system-ui, sans-serif);
	font-size: 1rem;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 150ms ease, transform 150ms ease;
	box-shadow: 0 4px 16px color-mix(in srgb, #5f5ed7 30%, transparent);
}

.gtl-start-btn:hover {
	opacity: 0.9;
	transform: translateY(-1px);
}

/* Fade transition between rounds */
.gtl-fade-enter-active,
.gtl-fade-leave-active {
	transition: opacity 200ms ease;
}

.gtl-fade-enter-from,
.gtl-fade-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.gtl-fade-enter-active,
	.gtl-fade-leave-active {
		transition: none;
	}
}
</style>
