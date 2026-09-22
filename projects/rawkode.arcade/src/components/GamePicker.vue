<script setup lang="ts">
import { computed, ref } from "vue";
import { css } from "@/../styled-system/css";
import { games, type GameId } from "@/lib/game-catalogue";
import {
	control,
	notice,
	row,
	runningOrder,
	slug,
	stage,
	text,
} from "@/styles/arcade";

/**
 * Formats are a sequence, so they render as a running order rather than six
 * identical cards. They carry no accent hue: a format is a category, not a
 * state (DESIGN.md, The Format Is Not A State Rule).
 */

const selected = ref<GameId>(games[0].id);
const creating = ref(false);
const error = ref("");

const selectedGame = computed(
	() => games.find((game) => game.id === selected.value) ?? games[0],
);

const order = computed(() =>
	games.map((game) => runningOrder({ state: game.id === selected.value ? "selected" : "default" })),
);

const footer = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", sm: "1fr auto" },
	gap: "4",
	alignItems: "center",
	mt: "5",
});

const summary = css({ display: "grid", gap: "2", minWidth: "0" });
const description = css({ display: "block", mt: "1" });

async function createRoom() {
	if (new URLSearchParams(window.location.search).get("seed") === "e2e") {
		error.value = "Seeded rooms are created by the protected test bootstrap.";
		return;
	}
	creating.value = true;
	error.value = "";
	try {
		const response = await fetch("/api/rooms", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({
				gameKey: selected.value,
				title: `${selectedGame.value.title} live`,
			}),
		});
		if (!response.ok)
			throw new Error("A host session is required to create a room.");
		const value = (await response.json()) as { room?: { id?: string } };
		if (!value.room?.id) throw new Error("The room was not created.");
		window.location.assign(`/host/${encodeURIComponent(value.room.id)}`);
	} catch (cause) {
		error.value =
			cause instanceof Error ? cause.message : "Unable to create a room.";
	} finally {
		creating.value = false;
	}
}
</script>

<template>
	<div>
		<div :class="order[0].root" role="radiogroup" aria-label="Choose a format">
			<button
				v-for="(game, index) in games"
				:key="game.id"
				type="button"
				role="radio"
				:class="order[index].item"
				:data-testid="`game-card-${game.id}`"
				:aria-checked="selected === game.id"
				@click="selected = game.id"
			>
				<span :class="order[index].index">FMT-{{ String(index + 1).padStart(2, "0") }}</span>
				<span :class="order[index].title">
					{{ game.title }}
					<small :class="[text({ style: 'bodySm', tone: 'soft' }), description]">
						{{ game.description }}
					</small>
				</span>
				<span :class="order[index].action">
					{{ selected === game.id ? "Selected" : game.players }}
				</span>
			</button>
		</div>

		<div :class="[stage({ tone: 'raised' }), footer]">
			<div :class="summary">
				<span :class="slug()">Selected · {{ selectedGame.mechanic }}</span>
				<strong :class="text({ style: 'title' })">{{ selectedGame.title }}</strong>
			</div>
			<button
				:class="control({ tone: 'live' })"
				type="button"
				data-testid="create-room"
				:disabled="creating"
				@click="createRoom"
			>
				{{ creating ? "Creating room…" : "Create live room" }}
			</button>
		</div>

		<p v-if="error" :class="[notice({ tone: 'error' }), row({ gap: 'tight' })]" aria-live="polite">
			<span :class="slug({ tone: 'closed' })">Error</span>
			<span>{{ error }}</span>
		</p>
	</div>
</template>
