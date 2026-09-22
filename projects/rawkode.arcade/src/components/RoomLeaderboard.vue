<script setup lang="ts">
import { onMounted, ref } from "vue";
import { css } from "@/../styled-system/css";
import {
	control,
	hairline,
	notice,
	scoreboard,
	sectionRule,
	shell,
	slug,
	text,
} from "@/styles/arcade";

const board = css({ py: "sectionTight" });
const empty = css({ display: "grid", gap: "4", justifyItems: "start", py: "section" });

function slots(index: number) {
	return scoreboard({ position: index === 0 ? "leading" : "default" });
}

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
	<div :class="[shell, board]" aria-live="polite">
		<div :class="sectionRule">
			<span :class="slug()">Verified result</span>
			<span v-if="roomId" :class="slug({ tone: 'live' })">Room {{ roomId }}</span>
		</div>

		<h1 :class="text({ style: 'headline' })">Final standings</h1>

		<div v-if="error" :class="empty">
			<p :class="[notice({ tone: 'info' }), text({ style: 'body' })]">{{ error }}</p>
			<a :class="control({ tone: 'quiet' })" href="/">Back to formats</a>
		</div>

		<ol
			v-else
			:class="[slots(1).root, hairline, css({ mt: '5' })]"
			aria-label="Final room leaderboard"
		>
			<li
				v-for="(entry, index) in entries"
				:key="`${entry.principalId}-${entry.teamId}`"
				:class="slots(index).row"
				:data-testid="`leaderboard-row-${roomId}-${entry.teamId ?? entry.principalId}`"
			>
				<span :class="slots(index).rank">{{ entry.rank }}</span>
				<span :class="slots(index).identity">
					<span :class="slots(index).name">{{ entry.teamId ?? entry.principalId }}</span>
					<span v-if="index === 0" :class="slots(index).flag">Winner</span>
				</span>
				<span :class="slots(index).score">{{ entry.score.toLocaleString("en-GB") }}</span>
			</li>
		</ol>
	</div>
</template>
