<template>
	<div class="p-6 md:p-10">
		<div v-if="isLoading" class="text-center text-sm text-gray-500 dark:text-gray-400">
			Loading…
		</div>

		<div v-else-if="!isAuthenticated" class="max-w-xl mx-auto text-center">
			<h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-50">Authentication required</h2>
			<p class="mt-2 text-gray-600 dark:text-gray-300">
				You need to sign in to play the daily challenge.
			</p>
			<a
				href="/sign-in"
				class="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-white"
			>
				Sign in
			</a>
		</div>

		<div v-else class="grid gap-8 lg:grid-cols-[1fr_360px]">
			<!-- Game panel -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h1 class="text-xl font-semibold text-gray-900 dark:text-gray-50">Guess the Logo</h1>
						<p class="text-sm text-gray-600 dark:text-gray-300">Daily 5 · 5 lives · same order for everyone</p>
					</div>
					<div class="text-right">
						<div class="text-xs text-gray-500 dark:text-gray-400">Lives</div>
						<div class="text-lg font-semibold text-gray-900 dark:text-gray-50">
							{{ livesRemaining }}/5
						</div>
					</div>
				</div>

				<div class="mt-6 grid gap-6 md:grid-cols-2">
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
						<div class="flex items-center justify-between">
							<div class="text-sm font-medium text-gray-700 dark:text-gray-200">Logo</div>
							<div class="text-sm text-gray-600 dark:text-gray-300">{{ progressLabel }}</div>
						</div>
						<div class="mt-4 flex h-40 items-center justify-center rounded-md bg-white dark:bg-gray-950">
							<img
								v-if="logoUrl"
								:src="logoUrl"
								alt="Technology logo"
								class="max-h-28 max-w-28 object-contain"
							/>
							<div v-else class="text-sm text-gray-500 dark:text-gray-400">Start to see today’s first logo.</div>
						</div>
					</div>

					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
						<div class="text-sm font-medium text-gray-700 dark:text-gray-200">Your answer</div>
						<div class="mt-3">
							<Combobox v-model="selectedTech" :disabled="isInputDisabled">
								<div class="relative">
									<ComboboxInput
										class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50"
										:displayValue="(t) => (t ? t.name : query)"
										placeholder="Type to search…"
										@change="query = $event.target.value"
										@keydown.enter.prevent="submitGuess()"
									/>
									<ComboboxOptions
										v-if="filteredTechs.length > 0 && query.length > 0"
										class="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-gray-800 dark:bg-gray-950"
									>
										<ComboboxOption
											v-for="tech in filteredTechs"
											:key="tech.id"
											:value="tech"
											class="cursor-pointer px-3 py-2 ui-active:bg-primary/10 ui-active:text-gray-900 dark:ui-active:text-gray-50"
										>
											{{ tech.name }}
										</ComboboxOption>
									</ComboboxOptions>
								</div>
							</Combobox>
						</div>

						<div class="mt-3 flex items-center gap-3">
							<button
								v-if="status === 'ready'"
								class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
								@click="start()"
							>
								Start today’s attempt
							</button>
							<button
								v-else
								class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
								:disabled="isInputDisabled"
								@click="submitGuess()"
							>
								Submit
							</button>
							<div v-if="feedback" class="text-sm" :class="feedbackClass">{{ feedback }}</div>
						</div>

						<div v-if="status === 'completed'" class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
							Completed in <span class="font-semibold">{{ formatMs(finalTimeMs) }}</span>.
						</div>
						<div v-else-if="status === 'out_of_lives'" class="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
							Out of lives for today.
						</div>
					</div>
				</div>
			</div>

			<!-- Sidebar: leaderboard + activity -->
			<div class="space-y-8">
				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-50">Today’s leaderboard</h2>
						<button
							class="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50"
							@click="loadLeaderboard()"
						>
							Refresh
						</button>
					</div>
					<div class="mt-4 space-y-2">
						<div
							v-for="entry in leaderboard"
							:key="entry.personId"
							class="flex items-center justify-between gap-3 text-sm"
						>
							<div class="truncate">
								<span class="text-gray-500 dark:text-gray-400">#{{ entry.rank }}</span>
								<span class="ml-2 font-medium text-gray-900 dark:text-gray-50">{{ entry.personName ?? 'Anonymous' }}</span>
							</div>
							<div class="font-mono text-gray-700 dark:text-gray-200">{{ formatMs(entry.timeMs) }}</div>
						</div>
						<div v-if="leaderboard.length === 0" class="text-sm text-gray-600 dark:text-gray-300">
							No perfect clears yet today.
						</div>
					</div>
				</div>

				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
					<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-50">Activity</h2>
					<div class="mt-4 grid grid-cols-14 gap-1">
						<div
							v-for="day in activity"
							:key="day.date"
							class="h-3 w-3 rounded-sm"
							:title="`${day.date}: ${day.logosCorrect} logos`"
							:style="{ backgroundColor: heatColor(day.logosCorrect) }"
						></div>
					</div>
					<div class="mt-3 text-xs text-gray-600 dark:text-gray-300">
						{{ activitySummary }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption } from "@headlessui/vue";

type GameStatus = "ready" | "playing" | "completed" | "out_of_lives";

type TechnologyOption = {
	id: string;
	name: string;
};

type LeaderboardEntry = {
	personId: string;
	personName: string | null;
	rank: number;
	timeMs: number;
};

type ActivityDay = {
	date: string;
	logosCorrect: number;
};

class ApiError extends Error {
	constructor(
		message: string,
		public statusCode: number,
	) {
		super(message);
	}
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
	});

	if (!response.ok) {
		const body = (await response
			.json()
			.catch((): { error: string } => ({ error: "Unknown error" }))) as {
			error?: string;
		};
		throw new ApiError(body.error ?? `Request failed: ${response.status}`, response.status);
	}

	return response.json();
}

const isLoading = ref(true);
const isAuthenticated = ref(false);

const date = ref<string | null>(null);
const status = ref<GameStatus>("ready");
const livesRemaining = ref(5);
const index = ref(0);
const logoUrl = ref<string | null>(null);
const finalTimeMs = ref<number | null>(null);

const techs = ref<TechnologyOption[]>([]);
const query = ref("");
const selectedTech = ref<TechnologyOption | null>(null);

const feedback = ref<string | null>(null);
const feedbackTone = ref<"good" | "bad" | null>(null);

const leaderboard = ref<LeaderboardEntry[]>([]);
const activity = ref<ActivityDay[]>([]);

const isInputDisabled = computed(() => status.value !== "playing" || livesRemaining.value <= 0);

const progressLabel = computed(() => `${Math.min(index.value + 1, 5)}/5`);

const filteredTechs = computed(() => {
	const q = query.value.trim().toLowerCase();
	if (!q) return [];
	return techs.value
		.filter((t) => t.name.toLowerCase().includes(q))
		.slice(0, 20);
});

const feedbackClass = computed(() => {
	if (feedbackTone.value === "good") return "text-emerald-700 dark:text-emerald-300";
	if (feedbackTone.value === "bad") return "text-rose-700 dark:text-rose-300";
	return "text-gray-600 dark:text-gray-300";
});

const activitySummary = computed(() => {
	const total = activity.value.reduce((sum, d) => sum + d.logosCorrect, 0);
	return `Last ${activity.value.length} days: ${total} logos guessed`;
});

function formatMs(ms: number | null): string {
	if (ms == null) return "—";
	const seconds = ms / 1000;
	return `${seconds.toFixed(2)}s`;
}

function heatColor(count: number): string {
	if (count <= 0) return "rgba(148,163,184,0.25)";
	if (count === 1) return "rgba(34,197,94,0.35)";
	if (count === 2) return "rgba(34,197,94,0.5)";
	if (count === 3) return "rgba(34,197,94,0.65)";
	if (count === 4) return "rgba(34,197,94,0.8)";
	return "rgba(34,197,94,1)";
}

async function loadTechs() {
	techs.value = await fetchJson<TechnologyOption[]>("/api/games/gtl/technologies");
}

async function loadPlayer() {
	try {
		const data = await fetchJson<{
			date: string;
			status: GameStatus;
			livesRemaining: number;
			index: number;
			logoUrl: string | null;
			finalTimeMs: number | null;
			activity: ActivityDay[];
		}>("/api/games/gtl/player");
		isAuthenticated.value = true;
		date.value = data.date;
		status.value = data.status;
		livesRemaining.value = data.livesRemaining;
		index.value = data.index;
		logoUrl.value = data.logoUrl;
		finalTimeMs.value = data.finalTimeMs;
		activity.value = data.activity;
	} catch (err) {
		if (err instanceof ApiError && err.statusCode === 401) {
			isAuthenticated.value = false;
			return;
		}
		throw err;
	}
}

async function start() {
	feedback.value = null;
	feedbackTone.value = null;
	selectedTech.value = null;
	query.value = "";

	const data = await fetchJson<{
		date: string;
		status: GameStatus;
		livesRemaining: number;
		index: number;
		logoUrl: string | null;
	}>('/api/games/gtl/start', { method: 'POST' });

	date.value = data.date;
	status.value = data.status;
	livesRemaining.value = data.livesRemaining;
	index.value = data.index;
	logoUrl.value = data.logoUrl;
	finalTimeMs.value = null;
	await loadLeaderboard();
}

async function submitGuess() {
	if (status.value !== "playing") return;
	if (!selectedTech.value) {
		feedback.value = "Pick a technology from the list.";
		feedbackTone.value = "bad";
		return;
	}

	const data = await fetchJson<{
		correct: boolean;
		status: GameStatus;
		livesRemaining: number;
		index: number;
		logoUrl: string | null;
		finalTimeMs: number | null;
	}>('/api/games/gtl/guess', {
		method: 'POST',
		body: JSON.stringify({ guessId: selectedTech.value.id }),
	});

	status.value = data.status;
	livesRemaining.value = data.livesRemaining;
	index.value = data.index;
	logoUrl.value = data.logoUrl;
	finalTimeMs.value = data.finalTimeMs;

	if (data.correct) {
		feedback.value = "Correct.";
		feedbackTone.value = "good";
	} else {
		feedback.value = "Wrong.";
		feedbackTone.value = "bad";
	}

	selectedTech.value = null;
	query.value = "";

	if (data.status === "completed") {
		await loadLeaderboard();
		await loadPlayer();
	}
}

async function loadLeaderboard() {
	if (!date.value) return;
	leaderboard.value = await fetchJson<LeaderboardEntry[]>(
		`/api/games/gtl/leaderboard?date=${encodeURIComponent(date.value)}&limit=20`,
	);
}

onMounted(async () => {
	try {
		await Promise.all([loadTechs(), loadPlayer()]);
		if (isAuthenticated.value) {
			await loadLeaderboard();
		}
	} finally {
		isLoading.value = false;
	}
});
</script>
