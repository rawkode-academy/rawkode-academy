<template>
	<div :class="gameTheme.root" class="leaderboard-container">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">LEADERBOARD</h2>

			<!-- Tab navigation -->
			<div class="tabs">
				<button
					v-for="tab in tabs"
					:key="tab.type"
					class="tab"
					:class="{ active: activeTab === tab.type }"
					@click="activeTab = tab.type"
				>
					{{ tab.label }}
				</button>
			</div>

			<!-- Loading state -->
			<div v-if="isLoading" class="loading">
				<div class="loading-spinner"></div>
				<p>Loading rankings...</p>
			</div>

			<!-- Error state -->
			<div v-else-if="error" class="error">
				<p>{{ error }}</p>
				<button class="retry-btn" @click="loadLeaderboard">
					[ RETRY ]
				</button>
			</div>

			<!-- Leaderboard table -->
			<div v-else class="table-container">
				<table class="leaderboard-table">
					<thead>
						<tr>
							<th class="rank-col">RANK</th>
							<th class="player-col">PLAYER</th>
							<th class="score-col">{{ scoreLabel }}</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(entry, index) in entries"
							:key="entry.personId"
							:class="{ 'current-player': entry.personId === currentPlayerId }"
						>
							<td class="rank-col">
								<span class="rank" :class="getRankClass(index + 1)">
									{{ index + 1 }}
								</span>
							</td>
							<td class="player-col">
								{{ entry.personName || 'Anonymous' }}
							</td>
							<td class="score-col">
								{{ formatScore(entry.score) }}
							</td>
						</tr>
						<tr v-if="entries.length === 0">
							<td colspan="3" class="empty">No entries yet. Be the first!</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Player's rank (if not in top list) -->
			<div v-if="playerRank && !isPlayerInList" class="player-rank">
				<p class="your-rank-label">YOUR RANK</p>
				<div class="your-rank-entry">
					<span class="rank">{{ playerRank.rank }}</span>
					<span class="player">{{ playerRank.personName || 'You' }}</span>
					<span class="score">{{ formatScore(playerRank.score) }}</span>
				</div>
			</div>

			<button class="back-btn" @click="$emit('close')">
				<span class="btn-text">[ BACK TO GAME ]</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
import { ref, computed, watch, onMounted } from "vue";
import {
	getLeaderboard,
	getPlayerRank,
	type LeaderboardEntry,
	type ScoreType,
} from "@/lib/game-api";

interface Tab {
	type: ScoreType;
	label: string;
}

const props = defineProps<{
	currentPlayerId?: string;
}>();

defineEmits<{
	close: [];
}>();

const tabs: Tab[] = [
	{ type: "total_wins", label: "WINS" },
	{ type: "win_streak", label: "STREAK" },
	{ type: "fastest_breach", label: "FASTEST" },
	{ type: "enemies_defeated", label: "ENEMIES" },
];

const activeTab = ref<ScoreType>("total_wins");
const entries = ref<LeaderboardEntry[]>([]);
const playerRank = ref<LeaderboardEntry | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const scoreLabel = computed(() => {
	switch (activeTab.value) {
		case "total_wins":
			return "WINS";
		case "win_streak":
			return "STREAK";
		case "fastest_breach":
			return "TIME";
		case "enemies_defeated":
			return "DEFEATED";
		default:
			return "SCORE";
	}
});

const isPlayerInList = computed(() => {
	if (!props.currentPlayerId) return false;
	return entries.value.some((e) => e.personId === props.currentPlayerId);
});

function getRankClass(rank: number): string {
	if (rank === 1) return "gold";
	if (rank === 2) return "silver";
	if (rank === 3) return "bronze";
	return "";
}

function formatScore(score: number): string {
	if (activeTab.value === "fastest_breach") {
		return `${score}s`;
	}
	return score.toLocaleString();
}

async function loadLeaderboard() {
	isLoading.value = true;
	error.value = null;

	try {
		const [leaderboardData, rankData] = await Promise.all([
			getLeaderboard(activeTab.value, 50),
			props.currentPlayerId
				? getPlayerRank(activeTab.value)
				: Promise.resolve(null),
		]);

		entries.value = leaderboardData;
		playerRank.value = rankData;
	} catch (err) {
		console.error("Failed to load leaderboard:", err);
		error.value = "Failed to load leaderboard. Please try again.";
	} finally {
		isLoading.value = false;
	}
}

watch(activeTab, () => {
	loadLeaderboard();
});

onMounted(() => {
	loadLeaderboard();
});
</script>

<style scoped>
.leaderboard-container {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	padding: 2rem;
}

.grid-bg {
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px),
		linear-gradient(90deg, color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px);
	background-size: 40px 40px;
}

.content {
	text-align: center;
	z-index: 1;
	width: 100%;
	max-width: 700px;
}

.title {
	font-size: 2.5rem;
	font-weight: 700;
	color: var(--colors-academy-accent);
	text-shadow: 0 0 20px color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent);
	letter-spacing: 0.1em;
	margin-bottom: 1.5rem;
}

.tabs {
	display: flex;
	justify-content: center;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
	flex-wrap: wrap;
}

.tab {
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
	padding: 0.75rem 1.25rem;
	font-family: inherit;
	font-size: 0.85rem;
	cursor: pointer;
	transition: all 0.3s ease;
	letter-spacing: 0.1em;
	backdrop-filter: blur(8px);
}

:root.dark .tab {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
}

.tab:hover {
	border-color: var(--colors-academy-accent);
	color: var(--colors-academy-accent);
}

.tab.active {
	border-color: var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	background: color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent);
}

.loading {
	padding: 3rem;
	color: var(--colors-academy-text-muted);
}

:root.dark .loading {
	color: var(--colors-academy-text-muted);
}

.loading-spinner {
	width: 40px;
	height: 40px;
	border: 3px solid color-mix(in srgb, var(--colors-academy-accent) 20.0%, transparent);
	border-top-color: var(--colors-academy-accent);
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin: 0 auto 1rem;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.error {
	padding: 2rem;
	color: var(--colors-academy-status-rust);
}

.retry-btn {
	background: transparent;
	border: 1px solid var(--colors-academy-status-rust);
	color: var(--colors-academy-status-rust);
	padding: 0.5rem 1rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	margin-top: 1rem;
}

.retry-btn:hover {
	background: color-mix(in srgb, var(--colors-academy-status-rust) 10.0%, transparent);
}

.table-container {
	background: var(--colors-academy-panel);
	border: 1px solid color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
	border-radius: 8px;
	overflow: hidden;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
}

:root.dark .table-container {
	background: var(--colors-academy-panel);
}

.leaderboard-table {
	width: 100%;
	border-collapse: collapse;
}

.leaderboard-table th {
	background: color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent);
	color: var(--colors-academy-accent);
	font-size: 0.8rem;
	font-weight: 600;
	letter-spacing: 0.1em;
	padding: 1rem 0.75rem;
	text-align: left;
}

.leaderboard-table td {
	padding: 0.75rem;
	border-top: 1px solid var(--colors-academy-border);
	color: var(--colors-academy-text);
	font-size: 0.9rem;
}

:root.dark .leaderboard-table td {
	border-top-color: var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
}

.leaderboard-table tr:hover td {
	background: color-mix(in srgb, var(--colors-academy-accent) 5.0%, transparent);
}

.leaderboard-table tr.current-player td {
	background: color-mix(in srgb, var(--colors-academy-status-violet) 10.0%, transparent);
	color: var(--colors-academy-status-violet);
}

.rank-col {
	width: 80px;
	text-align: center;
}

.player-col {
	text-align: left;
}

.score-col {
	width: 100px;
	text-align: right;
}

.rank {
	display: inline-block;
	width: 32px;
	height: 32px;
	line-height: 32px;
	border-radius: 50%;
	background: var(--colors-academy-border);
	font-weight: 600;
}

:root.dark .rank {
	background: var(--colors-academy-border);
}

.rank.gold {
	background: linear-gradient(135deg, var(--colors-academy-status-amber) 0%, var(--colors-academy-status-amber) 100%);
	color: var(--colors-academy-text);
}

.rank.silver {
	background: linear-gradient(135deg, var(--colors-academy-text-soft) 0%, var(--colors-academy-text-muted) 100%);
	color: var(--colors-academy-text);
}

.rank.bronze {
	background: linear-gradient(135deg, var(--colors-academy-status-amber) 0%, var(--colors-academy-status-amber) 100%);
	color: var(--colors-academy-text);
}

.empty {
	text-align: center;
	color: var(--colors-academy-text-muted);
	padding: 2rem;
}

:root.dark .empty {
	color: var(--colors-academy-text-muted);
}

.player-rank {
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-status-violet);
	border-radius: 8px;
	padding: 1rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
}

:root.dark .player-rank {
	background: var(--colors-academy-panel);
}

.your-rank-label {
	color: var(--colors-academy-status-violet);
	font-size: 0.8rem;
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.your-rank-entry {
	display: flex;
	align-items: center;
	justify-content: space-between;
	color: var(--colors-academy-status-violet);
}

.back-btn {
	background: transparent;
	border: 2px solid var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	padding: 1rem 2rem;
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.back-btn:hover {
	background: var(--colors-academy-accent);
	color: white;
}

:root.dark .back-btn:hover {
	color: var(--colors-academy-text);
}

.btn-text {
	animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
}
</style>
