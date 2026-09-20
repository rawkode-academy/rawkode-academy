<script setup lang="ts">
import { onMounted, ref } from "vue";

type ProjectedEntry = {
	principalId: string;
	teamId: string | null;
	score: number;
	rank: number;
};
const roomId = ref<string | null>(null);
const entries = ref<ProjectedEntry[]>([]);
const error = ref("");

onMounted(async () => {
	roomId.value = new URLSearchParams(window.location.search).get("roomId");
	if (!roomId.value) {
		error.value =
			"Open this page from a completed live room to view its projection.";
		return;
	}
	try {
		const response = await fetch(
			`/api/rooms/${encodeURIComponent(roomId.value)}/leaderboard`,
			{ credentials: "same-origin" },
		);
		if (!response.ok) throw new Error("The final result is not available yet.");
		const value = (await response.json()) as { entries?: ProjectedEntry[] };
		entries.value = Array.isArray(value.entries) ? value.entries : [];
	} catch (cause) {
		error.value =
			cause instanceof Error
				? cause.message
				: "Unable to load the leaderboard.";
	}
});
</script>
<template>
	<section class="board" aria-live="polite">
		<p>LIVE LEADERBOARDS</p>
		<h1>Ship. Score. <em>Repeat.</em></h1>
		<p v-if="error" class="message">{{ error }}</p>
		<ol v-else class="rows" aria-label="Final room leaderboard">
			<li
				v-for="entry in entries"
				:key="`${entry.principalId}-${entry.teamId}`"
				:data-testid="`leaderboard-row-${roomId}-${entry.teamId ?? entry.principalId}`"
			>
				<span>#{{ entry.rank }}</span>
				<strong>{{ entry.teamId ?? entry.principalId }}</strong>
				<small>{{ roomId }}</small>
				<b>{{ entry.score.toLocaleString() }}</b>
			</li>
		</ol>
	</section>
</template>
<style scoped>
.board { margin: auto; max-width: 900px; padding: 4rem 2rem; }.board > p:first-child { color: var(--cyan); font-family: "IBM Plex Mono", monospace; font-size: .65rem; letter-spacing: .1em; }.board h1 { font-family: "Space Grotesk", sans-serif; font-size: clamp(3rem, 7vw, 5rem); letter-spacing: -.08em; line-height: .85; }.board em { color: var(--cyan); font-style: normal; }.message { color: var(--mist); }.rows { display: grid; gap: .75rem; list-style: none; padding: 0; }.rows li { align-items: center; background: rgb(16 26 53 / 70%); border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 1rem; grid-template-columns: auto 1fr auto auto; padding: 1rem; }.rows span, .rows small { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .7rem; }.rows b { color: var(--lime); font-family: "Space Grotesk", sans-serif; font-size: 1.25rem; }
</style>
