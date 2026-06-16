<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { Round } from "@/lib/games/guess-the-logo";
import { scoreGame, computeScore, TIMER_SECONDS } from "@/lib/games/guess-the-logo";
import { ACHIEVEMENTS } from "@/lib/games/guess-the-logo-achievements";
import {
	getStatus,
	submitScore,
	getLeaderboard,
	getAchievements,
	getPlayerStats,
	type LeaderboardEntry,
	type PerCategoryCorrect,
	type PlayerStats,
} from "@/lib/games/guess-the-logo-api";
import RoundView from "./RoundView.vue";
import ResultsView from "./ResultsView.vue";

const props = defineProps<{
	rounds: Round[];
	date: string; // YYYY-MM-DD Monday of the current week
	playerName: string | null;
	disableAuth: boolean;
	poolSize: number;
}>();

type GameState = "loading" | "intro" | "playing" | "results";

const state = ref<GameState>("loading");
const currentIndex = ref(0);
const answers = ref<(string | null)[]>([]);
const timeLeftMsArr = ref<number[]>([]);
const revealed = ref(false);

// Results data
const finalScore = ref(0);
const finalCorrect = ref(0);
const finalPerRoundCorrect = ref<boolean[]>([]);
const earnedIds = ref<string[]>([]);
const newlyUnlocked = ref<string[]>([]);
const leaderboard = ref<LeaderboardEntry[]>([]);
const playerRank = ref<number | null>(null);
const alreadyPlayed = ref(false);
const playerAchievements = ref<{ achievementId: string; unlockedAt: string }[]>([]);
const playerStats = ref<PlayerStats | null>(null);

// Derive "Week of Mon D" label from the date prop (Monday YYYY-MM-DD)
const weekLabel = computed(() => {
	const [year, month, day] = props.date.split("-").map(Number);
	const d = new Date(Date.UTC(year, month - 1, day));
	return "Week of " + d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
});

async function loadResultsData(existingScore: number | null = null, existingRank: number | null = null) {
	const [lb, achs, stats] = await Promise.all([
		getLeaderboard(10).catch(() => [] as LeaderboardEntry[]),
		getAchievements().catch(() => [] as { achievementId: string; unlockedAt: string }[]),
		getPlayerStats().catch(() => null),
	]);
	leaderboard.value = lb;
	playerAchievements.value = achs;
	playerStats.value = stats;

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
				finalPerRoundCorrect.value = [];
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
	timeLeftMsArr.value = [];
	revealed.value = false;
	state.value = "playing";
}

async function handleAnswer(name: string | null, timeLeftMs: number) {
	// Record answer and timing for current round
	const idx = currentIndex.value;
	const newAnswers = [...answers.value];
	newAnswers[idx] = name;
	answers.value = newAnswers;

	const newTimes = [...timeLeftMsArr.value];
	newTimes[idx] = timeLeftMs;
	timeLeftMsArr.value = newTimes;

	// Reveal the logo
	revealed.value = true;

	// Wait ~900ms then advance
	await new Promise<void>((resolve) => setTimeout(resolve, 900));

	if (idx + 1 < props.rounds.length) {
		currentIndex.value = idx + 1;
		revealed.value = false;
	} else {
		// All rounds done — compute results
		await finishGame(newAnswers, newTimes);
	}
}

async function finishGame(finalAnswers: (string | null)[], finalTimes: number[]) {
	const points = computeScore(props.rounds, finalAnswers, finalTimes);
	const correct = scoreGame(finalAnswers, props.rounds);
	const perRoundCorrect = props.rounds.map((r, i) => finalAnswers[i] === r.answer);

	// Derive per-category correct counts
	const perCategoryCorrect: PerCategoryCorrect = {
		sandbox: 0,
		incubating: 0,
		graduated: 0,
		archived: 0,
		nonCncf: 0,
	};
	const correctLogoNames: string[] = [];

	for (let i = 0; i < props.rounds.length; i++) {
		const round = props.rounds[i];
		if (round && finalAnswers[i] === round.answer) {
			correctLogoNames.push(round.logo.name);
			const status = round.logo.cncfStatus;
			if (status === "sandbox") perCategoryCorrect.sandbox++;
			else if (status === "incubating") perCategoryCorrect.incubating++;
			else if (status === "graduated") perCategoryCorrect.graduated++;
			else if (status === "archived") perCategoryCorrect.archived++;
			else perCategoryCorrect.nonCncf++;
		}
	}

	const perfect = correct === props.rounds.length && props.rounds.length === 5;

	// fastWeek: every correct answer had > 50% time remaining
	const timerTotalMs = TIMER_SECONDS * 1000;
	let fastWeek = correct > 0;
	for (let i = 0; i < props.rounds.length; i++) {
		const round = props.rounds[i];
		if (round && finalAnswers[i] === round.answer) {
			const tLeft = finalTimes[i] ?? 0;
			if (tLeft <= timerTotalMs * 0.5) {
				fastWeek = false;
				break;
			}
		}
	}

	finalScore.value = points;
	finalCorrect.value = correct;
	finalPerRoundCorrect.value = perRoundCorrect;
	alreadyPlayed.value = false;

	if (!props.disableAuth) {
		try {
			// Submit richer payload — server records stats + unlocks achievements
			const scoreResult = await submitScore({
				score: points,
				correct,
				perCategoryCorrect,
				perfect,
				fastWeek,
				correctLogoNames,
				poolSize: props.poolSize,
			});
			playerRank.value = scoreResult.rank;
			newlyUnlocked.value = scoreResult.newlyUnlocked ?? [];
		} catch {
			playerRank.value = null;
			newlyUnlocked.value = [];
		}

		// Load fresh leaderboard + all achievements + player stats
		await loadResultsData(points, playerRank.value);

		// Overlay earnedIds with newlyUnlocked so the UI shows them immediately
		// even before the server round-trips all achievements
		if (newlyUnlocked.value.length > 0) {
			const merged = new Set([...earnedIds.value, ...newlyUnlocked.value]);
			earnedIds.value = Array.from(merged);
		}
	} else {
		// Dev/no-auth path: show score without server calls
		newlyUnlocked.value = perfect ? ["flawless"] : [];
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
			<p class="gtl-loading-text">Loading this week's puzzle...</p>
		</div>

		<!-- Intro -->
		<div v-else-if="state === 'intro'" class="gtl-intro gtl-center">
			<p class="gtl-intro-eyebrow">Weekly Challenge</p>
			<h1 class="gtl-intro-title">CNIcon</h1>
			<p class="gtl-intro-week">{{ weekLabel }}</p>
			<p class="gtl-intro-desc">
				5 cloud native logos. 4 options each. 15 seconds per logo. One shot per week.
			</p>
			<button class="gtl-start-btn" @click="startGame">Start</button>
		</div>

		<!-- Playing — keyed RoundView WITHOUT a Transition wrapper to avoid stale-highlight bug -->
		<RoundView
			v-else-if="state === 'playing'"
			:key="currentIndex"
			:round="rounds[currentIndex]"
			:index="currentIndex"
			:total="rounds.length"
			:revealed="revealed"
			@answer="handleAnswer"
		/>

		<!-- Results -->
		<ResultsView
			v-else-if="state === 'results'"
			:score="finalScore"
			:correct="finalCorrect"
			:total="rounds.length"
			:per-round-correct="finalPerRoundCorrect"
			:earned-ids="earnedIds"
			:newly-unlocked="newlyUnlocked"
			:achievements="ACHIEVEMENTS"
			:leaderboard="leaderboard"
			:rank="playerRank"
			:already-played="alreadyPlayed"
			:week-label="weekLabel"
			:date="date"
			:is-signed-in="!disableAuth"
			:stats="playerStats"
			:pool-size="poolSize"
			:player-name="playerName"
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

.gtl-intro-week {
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
</style>
