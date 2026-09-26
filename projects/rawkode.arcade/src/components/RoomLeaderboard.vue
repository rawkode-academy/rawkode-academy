<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { loadRoomLeaderboard, type ProjectedEntry } from "@/lib/projected-leaderboard";
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

const roomId = ref<string | null>(null);
const entries = ref<ProjectedEntry[]>([]);
const error = ref("");
const loading = ref(false);
let activeRequest: AbortController | undefined;

async function loadResults() {
	activeRequest?.abort();
	if (!roomId.value) {
		error.value =
			"Open this page from a completed live room to view its projection.";
		return;
	}
	const request = new AbortController();
	activeRequest = request;
	loading.value = true;
	error.value = "";
	try {
		const result = await loadRoomLeaderboard(roomId.value, request.signal);
		if (!request.signal.aborted) entries.value = result;
	} catch (cause) {
		if (!request.signal.aborted) {
			error.value = cause instanceof Error ? cause.message : "Unable to load the leaderboard.";
		}
	} finally {
		if (!request.signal.aborted) loading.value = false;
	}
}

onMounted(() => {
	roomId.value = new URLSearchParams(window.location.search).get("roomId");
	void loadResults();
});
onBeforeUnmount(() => activeRequest?.abort());
</script>

<template>
	<div :class="[shell, board]" aria-live="polite">
		<div :class="sectionRule">
			<span :class="slug()">Verified result</span>
			<span v-if="roomId" :class="slug({ tone: 'live' })" data-testid="leaderboard-room-id">Room {{ roomId }}</span>
		</div>

		<h1 :class="text({ style: 'headline' })">Final standings</h1>

		<div v-if="loading" :class="empty" role="status" aria-busy="true">
			<p :class="text({ style: 'body' })">Preparing final results… This may take a few moments.</p>
		</div>
		<div v-else-if="error" :class="empty">
			<p :class="[notice({ tone: 'info' }), text({ style: 'body' })]">{{ error }}</p>
			<button v-if="roomId" :class="control({ tone: 'quiet' })" type="button" @click="loadResults">Try again</button>
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
