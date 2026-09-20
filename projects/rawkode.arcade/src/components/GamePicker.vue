<script setup lang="ts">
import { ref } from "vue";
import { games, type GameId } from "@/lib/game-catalogue";
import { arcadeCard, arcadeControl } from "@/styles/arcade";

const selected = ref<GameId>(games[0].id);
const creating = ref(false);
const error = ref("");
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
				title: `${games.find((game) => game.id === selected.value)?.title} live`,
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
	<div class="picker" aria-label="Choose a game format">
		<button v-for="game in games" :key="game.id" type="button" :class="[arcadeCard({ tone: selected === game.id ? 'live' : 'default', padding: 'comfortable' }), 'format-card', `theme-${game.accent}`, { selected: selected === game.id }]" :data-testid="`game-card-${game.id}`" :aria-pressed="selected === game.id" @click="selected = game.id"><span>{{ game.kicker }}</span><b>{{ game.title }}</b><small>{{ game.mechanic }}</small></button>
		<div :class="[arcadeCard({ tone: 'raised' }), 'create-card']"><span>Selected format</span><strong>{{ games.find((game) => game.id === selected)?.title }}</strong><p v-if="error" class="create-error" aria-live="polite">{{ error }}</p><button :class="arcadeControl({ tone: 'accent' })" type="button" data-testid="create-room" :disabled="creating" @click="createRoom">{{ creating ? 'Creating…' : 'Create live room' }} <i aria-hidden="true">→</i></button></div>
	</div>
</template>
<style scoped>
.picker { display: grid; gap: 1rem; grid-template-columns: repeat(3, 1fr); }.format-card, .create-card { background: linear-gradient(145deg, rgb(24 38 74 / 95%), rgb(16 26 53 / 95%)); border: 1px solid var(--line); border-radius: 16px; min-height: 150px; padding: 1rem; text-align: left; }.format-card { color: var(--cloud); display: grid; gap: .6rem; transition: border-color .15s ease, transform .15s ease; }.format-card:hover, .format-card.selected { border-color: var(--accent); transform: translateY(-2px); }.format-card span, .create-card span { color: var(--accent); font-family: "IBM Plex Mono", monospace; font-size: .6rem; letter-spacing: .08em; text-transform: uppercase; }.format-card b { font-family: "Space Grotesk", sans-serif; font-size: 1.25rem; letter-spacing: -.05em; line-height: 1; }.format-card small { color: var(--mist); font-size: .67rem; }.create-card { align-items: start; display: grid; grid-column: span 3; grid-template-columns: 1fr auto; }.create-card strong { font-family: "Space Grotesk", sans-serif; font-size: 1.35rem; letter-spacing: -.05em; }.create-card button { align-self: center; background: var(--cyan); border: 0; border-radius: 8px; color: var(--ink); font-size: .8rem; font-weight: 800; grid-row: span 2; padding: .8rem; }.create-card i { font-size: 1.1rem; font-style: normal; }.create-error { color: var(--coral); font-size: .72rem; margin: .4rem 0 0; }.theme-cyan { --accent: var(--cyan); }.theme-violet { --accent: var(--violet); }.theme-lime { --accent: var(--lime); }.theme-amber { --accent: var(--amber); }.theme-coral { --accent: var(--coral); }.theme-pink { --accent: #ff83d3; }@media (max-width: 760px) { .picker { grid-template-columns: repeat(2, 1fr); }.create-card { grid-column: span 2; } }@media (max-width: 500px) { .picker { grid-template-columns: 1fr; }.create-card { grid-column: auto; grid-template-columns: 1fr; }.create-card button { grid-row: auto; } }
</style>
