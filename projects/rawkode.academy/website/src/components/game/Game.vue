<template>
	<div class="game-container">
		<!-- Loading state -->
		<div v-if="isLoading" class="loading-screen">
			<div class="loading-content">
				<div class="loading-spinner"></div>
				<p class="loading-text">Connecting to cluster...</p>
			</div>
		</div>

		<!-- Dev mode warning -->
		<div v-if="devMode" class="dev-mode-banner">
			⚠️ DEV MODE - Progress will not persist across sessions
		</div>

		<!-- Auth required state -->
		<div v-else-if="!isAuthenticated" class="auth-screen">
			<div class="auth-content">
				<h2 class="auth-title">AUTHENTICATION REQUIRED</h2>
				<p class="auth-text">You must be logged in to access the cluster.</p>
				<a href="/sign-in" class="auth-btn">
					<span class="btn-text">[ AUTHENTICATE ]</span>
				</a>
			</div>
		</div>

		<!-- Game states -->
		<Transition v-else name="fade" mode="out-in">
			<MenuScreen
				v-if="gameState === 'menu'"
				@start="handleStart"
				@view-achievements="showAchievements"
				@view-leaderboard="showLeaderboard"
			/>
			<InitialAllocationScreen
				v-else-if="gameState === 'allocation'"
				:assigned-insults="learnedInsults"
				:assigned-comebacks="learnedComebacks"
				@continue="handleAllocationComplete"
			/>
			<ClusterMap
				v-else-if="gameState === 'map'"
				:defeated-enemies="defeatedEnemies"
				:dev-mode="devMode"
				@select-enemy="startCombat"
				@view-inventory="showInventory"
				@view-achievements="showAchievements"
				@view-leaderboard="showLeaderboard"
			/>
			<CombatScreen
				v-else-if="gameState === 'combat' && currentEnemy"
				:enemy="currentEnemy"
				:player-name="playerName"
				:learned-insults="learnedInsults"
				:learned-comebacks="learnedComebacks"
				@victory="handleVictory"
				@defeat="handleDefeat"
				@flee="handleFlee"
				@learn-insult="handleLearnInsult"
				@learn-comeback="handleLearnComeback"
			/>
			<VictoryScreen
				v-else-if="gameState === 'victory' && lastVictory"
				:enemy-id="lastVictory.enemyId"
				:enemy-name="lastVictory.enemyName"
				:move-count="lastVictory.moveCount"
				:time-seconds="lastVictory.timeSeconds"
				:rank="playerProgress?.rank"
				@continue="handleVictoryContinue"
				@view-leaderboard="showLeaderboard"
			/>
			<DefeatScreen
				v-else-if="gameState === 'defeat' && lastDefeat"
				:enemy-name="lastDefeat.enemyName"
				:learned-insults="lastDefeat.learnedInsults"
				:learned-comebacks="lastDefeat.learnedComebacks"
				@continue="handleDefeatContinue"
			/>
			<Achievements
				v-else-if="gameState === 'achievements'"
				:achievements="playerProgress?.achievements ?? []"
				@close="returnFromOverlay"
			/>
			<Leaderboard
				v-else-if="gameState === 'leaderboard'"
				:current-player-id="playerProgress?.personId"
				@close="returnFromOverlay"
			/>
			<Inventory
				v-else-if="gameState === 'inventory'"
				:insults="learnedInsults"
				:comebacks="learnedComebacks"
				@close="returnFromOverlay"
			/>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { EnemyData, Insult, Comeback } from "@/game/data/types";
import { insults as allInsults, comebacks as allComebacks } from "@/game/data/insults";
import MenuScreen from "./MenuScreen.vue";
import InitialAllocationScreen from "./InitialAllocationScreen.vue";
import ClusterMap from "./ClusterMap.vue";
import CombatScreen from "./CombatScreen.vue";
import VictoryScreen from "./VictoryScreen.vue";
import DefeatScreen from "./DefeatScreen.vue";
import Achievements from "./Achievements.vue";
import Leaderboard from "./Leaderboard.vue";
import Inventory from "./Inventory.vue";
import {
	getPlayerProgress,
	initializePlayer,
	recordGameResult,
	learnInsult as apiLearnInsult,
	learnComeback as apiLearnComeback,
	type PlayerProgress,
} from "@/lib/game-api";

type GameState = "menu" | "allocation" | "map" | "combat" | "victory" | "defeat" | "achievements" | "leaderboard" | "inventory";

const gameState = ref<GameState>("menu");
const currentEnemy = ref<EnemyData | null>(null);
const defeatedEnemies = ref<string[]>([]);
const learnedInsults = ref<Insult[]>([]);
const learnedComebacks = ref<Comeback[]>([]);
const isNewPlayer = ref(true);

// New state for auth and loading
const isLoading = ref(true);
const isAuthenticated = ref(false);
const devMode = ref(false);
const combatStartTime = ref<number | null>(null);
const playerProgress = ref<PlayerProgress | null>(null);
const playerName = ref<string>("Player");
const previousState = ref<GameState | null>(null);
const lastVictory = ref<{
	enemyId: string;
	enemyName: string;
	moveCount: number;
	timeSeconds: number;
} | null>(null);
const lastDefeat = ref<{
	enemyName: string;
	learnedInsults: Insult[];
	learnedComebacks: Comeback[];
} | null>(null);
// Track phrases learned during current combat session
const combatLearnedInsults = ref<Insult[]>([]);
const combatLearnedComebacks = ref<Comeback[]>([]);

// Convert stored phrase IDs to full Insult/Comeback objects
function idsToInsults(ids: string[]): Insult[] {
	return ids
		.map((id) => allInsults.find((i) => i.id === id))
		.filter((i): i is Insult => i !== undefined);
}

function idsToComebacks(ids: string[]): Comeback[] {
	return ids
		.map((id) => allComebacks.find((c) => c.id === id))
		.filter((c): c is Comeback => c !== undefined);
}

// Check if an error is an authentication error (401)
function isAuthenticationError(error: unknown): boolean {
	if (error instanceof Error && error.message.includes("401")) {
		return true;
	}
	if (
		error instanceof Error &&
		error.name === "GameApiError" &&
		"statusCode" in error &&
		(error as { statusCode: number }).statusCode === 401
	) {
		return true;
	}
	return false;
}

// Load player progress from the backend and update state
function loadPlayerProgress(progress: PlayerProgress): void {
	isAuthenticated.value = true;
	playerProgress.value = progress;
	isNewPlayer.value = false;
	playerName.value = progress.personName ?? "Player";
	learnedInsults.value = idsToInsults(progress.learnedInsults);
	learnedComebacks.value = idsToComebacks(progress.learnedComebacks);
	console.log("[Game] Loaded phrases - insults:", learnedInsults.value.length, "comebacks:", learnedComebacks.value.length);
}

// Load player progress on mount
onMounted(async () => {
	// Check for dev auth bypass
	const gameRoot = document.getElementById("game-root");
	const disableAuth = gameRoot?.dataset.disableAuth === "true";

	if (disableAuth) {
		console.warn("[DEV] Auth bypass enabled - progress will not persist");
		isAuthenticated.value = true;
		isNewPlayer.value = true;
		devMode.value = true;
		isLoading.value = false;
		return;
	}

	try {
		// Try to get player progress - will fail with 401 if not authenticated
		const progress = await getPlayerProgress();
		console.log("[Game] Loaded player progress:", {
			personId: progress?.personId,
			hasProgress: !!progress,
			insultsCount: progress?.learnedInsults?.length ?? 0,
			comebacksCount: progress?.learnedComebacks?.length ?? 0,
		});

		if (progress) {
			// Existing player - load their saved progress
			loadPlayerProgress(progress);
		} else {
			// Player exists in auth but not in game services - will initialize on first play
			console.log("[Game] No player progress found - treating as new player");
			isAuthenticated.value = true;
			isNewPlayer.value = true;
		}
	} catch (error: unknown) {
		// Check if it's an auth error
		if (isAuthenticationError(error)) {
			console.log("[Game] Authentication error - user not logged in");
			isAuthenticated.value = false;
		} else {
			// Network or server error - retry once before giving up
			console.error("Failed to load player progress, retrying once:", error);
			try {
				const progress = await getPlayerProgress();
				if (progress) {
					console.log("[Game] Retry successful - loaded", progress.learnedInsults.length, "insults and", progress.learnedComebacks.length, "comebacks");
					loadPlayerProgress(progress);
				} else {
					console.log("[Game] Retry returned null - treating as new player");
					isAuthenticated.value = true;
					isNewPlayer.value = true;
				}
			} catch (retryError) {
				console.error("Retry also failed:", retryError);
				// If retry fails with auth error, not authenticated
				if (isAuthenticationError(retryError)) {
					isAuthenticated.value = false;
				} else {
					// Other error - assume authenticated but couldn't load progress
					isAuthenticated.value = true;
					isNewPlayer.value = true;
				}
			}
		}
	} finally {
		isLoading.value = false;
	}
});

async function handleStart() {
	console.log("[Game] handleStart called - isNewPlayer:", isNewPlayer.value);
	if (isNewPlayer.value) {
		// Initialize player in backend first to get assigned phrases
		try {
			console.log("[Game] Initializing new player...");
			const progress = await initializePlayer();
			playerProgress.value = progress;
			playerName.value = progress.personName ?? "Player";
			// Set the phrases that were assigned by the backend
			learnedInsults.value = idsToInsults(progress.learnedInsults);
			learnedComebacks.value = idsToComebacks(progress.learnedComebacks);
			console.log("[Game] Player initialized - insults:", learnedInsults.value.length, "comebacks:", learnedComebacks.value.length);
		} catch (error) {
			console.error("Failed to initialize player:", error);
			// Fallback to random local phrases if backend fails
			learnedInsults.value = getRandomItems(allInsults, 2);
			learnedComebacks.value = getRandomItems(allComebacks, 2);
			console.log("[Game] Using fallback phrases - insults:", learnedInsults.value.length, "comebacks:", learnedComebacks.value.length);
		}
		gameState.value = "allocation";
	} else {
		console.log("[Game] Existing player - going to map with", learnedInsults.value.length, "insults and", learnedComebacks.value.length, "comebacks");
		gameState.value = "map";
	}
}

function getRandomItems<T>(array: T[], count: number): T[] {
	const shuffled = [...array].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

function handleAllocationComplete() {
	// Player already initialized in handleStart, just transition to map
	isNewPlayer.value = false;
	gameState.value = "map";
}

function startCombat(enemy: EnemyData) {
	currentEnemy.value = enemy;
	combatStartTime.value = Date.now();
	// Clear phrases learned tracking for this combat
	combatLearnedInsults.value = [];
	combatLearnedComebacks.value = [];
	gameState.value = "combat";
}

async function handleVictory(moveCount: number) {
	if (currentEnemy.value) {
		defeatedEnemies.value.push(currentEnemy.value.id);

		// Calculate play time
		const playTimeSeconds = combatStartTime.value
			? Math.floor((Date.now() - combatStartTime.value) / 1000)
			: 0;

		// Store victory data for VictoryScreen
		lastVictory.value = {
			enemyId: currentEnemy.value.id,
			enemyName: currentEnemy.value.name,
			moveCount,
			timeSeconds: playTimeSeconds,
		};

		// Record game result
		try {
			const progress = await recordGameResult({
				won: true,
				playTimeSeconds,
				enemyDefeated: true,
			});
			playerProgress.value = progress;
		} catch (error) {
			console.error("Failed to record game result:", error);
		}
	}

	currentEnemy.value = null;
	combatStartTime.value = null;
	gameState.value = "victory";
}

async function handleDefeat() {
	// Calculate play time
	const playTimeSeconds = combatStartTime.value
		? Math.floor((Date.now() - combatStartTime.value) / 1000)
		: 0;

	// Store defeat data for DefeatScreen
	lastDefeat.value = {
		enemyName: currentEnemy.value?.name ?? "Unknown",
		learnedInsults: [...combatLearnedInsults.value],
		learnedComebacks: [...combatLearnedComebacks.value],
	};

	// Record game result
	try {
		const progress = await recordGameResult({
			won: false,
			playTimeSeconds,
		});
		playerProgress.value = progress;
	} catch (error) {
		console.error("Failed to record game result:", error);
	}

	currentEnemy.value = null;
	combatStartTime.value = null;
	gameState.value = "defeat";
}

function handleFlee() {
	// Just go back to map without recording anything
	currentEnemy.value = null;
	combatStartTime.value = null;
	gameState.value = "map";
}

async function handleLearnInsult(insult: Insult) {
	if (!learnedInsults.value.some((i) => i.id === insult.id)) {
		console.log("[Game] Learning new insult:", insult.id);
		learnedInsults.value.push(insult);
		// Track for current combat session
		combatLearnedInsults.value.push(insult);

		// Persist to backend
		try {
			const success = await apiLearnInsult(insult.id);
			console.log("[Game] Insult saved to backend:", success);
		} catch (error) {
			console.error("Failed to save learned insult:", error);
		}
	} else {
		console.log("[Game] Insult already learned:", insult.id);
	}
}

async function handleLearnComeback(comeback: Comeback) {
	if (!learnedComebacks.value.some((c) => c.id === comeback.id)) {
		console.log("[Game] Learning new comeback:", comeback.id);
		learnedComebacks.value.push(comeback);
		// Track for current combat session
		combatLearnedComebacks.value.push(comeback);

		// Persist to backend
		try {
			const success = await apiLearnComeback(comeback.id);
			console.log("[Game] Comeback saved to backend:", success);
		} catch (error) {
			console.error("Failed to save learned comeback:", error);
		}
	} else {
		console.log("[Game] Comeback already learned:", comeback.id);
	}
}

function handleVictoryContinue() {
	lastVictory.value = null;
	gameState.value = "map";
}

function handleDefeatContinue() {
	lastDefeat.value = null;
	gameState.value = "map";
}

function showLeaderboard() {
	previousState.value = gameState.value;
	gameState.value = "leaderboard";
}

function showAchievements() {
	previousState.value = gameState.value;
	gameState.value = "achievements";
}

function showInventory() {
	previousState.value = gameState.value;
	gameState.value = "inventory";
}

function returnFromOverlay() {
	gameState.value = previousState.value ?? "menu";
}
</script>

<style scoped>
.game-container {
	width: 100%;
	min-height: calc(100vh - 200px);
	font-family: "JetBrains Mono", "Fira Code", monospace;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

/* Loading screen */
.loading-screen {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: center;
	justify-content: center;
}

.loading-content {
	text-align: center;
}

.loading-spinner {
	width: 60px;
	height: 60px;
	border: 3px solid rgb(var(--brand-primary) / 0.2);
	border-top-color: rgb(var(--brand-primary));
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin: 0 auto 1.5rem;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.loading-text {
	color: rgb(var(--brand-primary));
	font-size: 1.1rem;
	letter-spacing: 0.1em;
	animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}

/* Auth screen */
.auth-screen {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}

.auth-screen::before {
	content: "";
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(rgb(var(--brand-primary) / 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgb(var(--brand-primary) / 0.1) 1px, transparent 1px);
	background-size: 40px 40px;
}

.auth-content {
	text-align: center;
	z-index: 1;
	padding: 3rem;
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(var(--brand-primary) / 0.3);
	border-radius: 12px;
	backdrop-filter: blur(12px);
}

:root.dark .auth-content {
	background: rgb(0 0 0 / 0.6);
}

.auth-title {
	font-size: 2rem;
	font-weight: 700;
	color: #d97706;
	text-shadow: 0 0 20px rgb(217 119 6 / 0.5);
	letter-spacing: 0.1em;
	margin-bottom: 1rem;
}

:root.dark .auth-title {
	color: #f1c40f;
	text-shadow: 0 0 20px rgba(241, 196, 15, 0.5);
}

.auth-text {
	color: rgb(107 114 128);
	font-size: 1.1rem;
	margin-bottom: 2rem;
}

:root.dark .auth-text {
	color: rgb(156 163 175);
}

.auth-btn {
	display: inline-block;
	background: transparent;
	border: 2px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	padding: 1rem 2.5rem;
	font-family: inherit;
	font-size: 1.2rem;
	cursor: pointer;
	transition: all 0.3s ease;
	text-decoration: none;
}

.auth-btn:hover {
	background: rgb(var(--brand-primary));
	color: white;
}

:root.dark .auth-btn:hover {
	color: rgb(17 24 39);
}

.btn-text {
	animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
}

/* Dev mode banner */
.dev-mode-banner {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	background: #f59e0b;
	color: #78350f;
	padding: 0.5rem 1rem;
	text-align: center;
	font-weight: 600;
	font-size: 0.875rem;
	z-index: 9999;
	border-bottom: 2px solid #d97706;
}

:root.dark .dev-mode-banner {
	background: #92400e;
	color: #fef3c7;
	border-bottom-color: #78350f;
}
</style>
