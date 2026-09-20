<script setup lang="ts">
import { ref } from "vue";
import { joinBootstrapKey, requestJoin } from "@/lib/room-bootstrap";
const name = ref("");
const roomCode = ref("");
const teamId = ref("team-red");
const role = ref<"contestant" | "audience">("contestant");
const error = ref("");
const pending = ref(false);
async function join() {
	if (!name.value.trim() || !roomCode.value.trim()) {
		error.value = "Enter a display name and room code.";
		return;
	}
	// Invite codes are opaque and case-sensitive: preserve the entered value.
	const code = roomCode.value.trim();
	const desiredRole = role.value === "contestant" ? "player" : "audience";
	pending.value = true;
	error.value = "";
	try {
		const player = { name: name.value.trim(), teamId: teamId.value };
		sessionStorage.setItem("rawkode-arcade-player", JSON.stringify(player));
		const bootstrap = await requestJoin(code, {
			displayName: player.name,
			teamId: player.teamId,
			desiredRole,
		});
		if (bootstrap.role !== desiredRole)
			throw new Error("The room did not return a valid live connection.");
		sessionStorage.setItem(
			joinBootstrapKey,
			JSON.stringify({ ...bootstrap, code }),
		);
		window.location.assign(
			`/${role.value === "contestant" ? "play" : "audience"}/${encodeURIComponent(code)}`,
		);
	} catch (cause) {
		error.value =
			cause instanceof Error ? cause.message : "Unable to join the room.";
		pending.value = false;
	}
}
</script>
<template>
	<form class="join-form" @submit.prevent="join">
		<label>Display name<input v-model="name" data-testid="display-name" autocomplete="nickname" maxlength="30" aria-describedby="join-error" /></label>
		<label>Room code<input v-model="roomCode" data-testid="room-code-input" autocomplete="off" maxlength="80" /></label>
		<fieldset><legend>Join a team</legend><label v-for="team in [{ id: 'team-red', label: 'The Merge Queue' }, { id: 'team-blue', label: 'Cache Invalidators' }]" :key="team.id" class="team-choice" :data-testid="`team-choice-${team.id}`"><input v-model="teamId" type="radio" name="team" :value="team.id" /><span>{{ team.label }}</span></label></fieldset>
		<fieldset><legend>How are you playing?</legend><label class="team-choice"><input v-model="role" type="radio" name="role" value="contestant" /><span>Contestant</span></label><label class="team-choice"><input v-model="role" type="radio" name="role" value="audience" /><span>Audience</span></label></fieldset>
		<p id="join-error" class="error" aria-live="polite">{{ error }}</p><button type="submit" data-testid="join-room" :disabled="pending">{{ pending ? 'Joining…' : 'Join live room' }} <span>→</span></button>
	</form>
</template>
<style scoped>
.join-form { display: grid; gap: .8rem; }.join-form > label, fieldset { color: var(--mist); display: grid; font-family: "IBM Plex Mono", monospace; font-size: .62rem; gap: .4rem; letter-spacing: .07em; text-transform: uppercase; }.join-form input:not([type='radio']) { background: rgb(8 13 29 / 62%); border: 1px solid var(--line); border-radius: 8px; color: var(--cloud); font-family: Inter, sans-serif; font-size: .9rem; padding: .72rem; }.join-form fieldset { border: 0; margin: 0; padding: 0; }.team-choice { align-items: center; background: rgb(8 13 29 / 38%); border: 1px solid var(--line); border-radius: 8px; color: var(--cloud); display: flex; font-family: Inter, sans-serif; font-size: .8rem; gap: .5rem; letter-spacing: 0; margin-top: .4rem; padding: .62rem; text-transform: none; }.team-choice:has(input:checked) { border-color: var(--cyan); }.team-choice input { accent-color: var(--cyan); }.error { color: var(--coral); font-size: .68rem; margin: 0; min-height: 1em; }.join-form button { background: var(--cyan); border: 0; border-radius: 8px; color: var(--ink); font-size: .84rem; font-weight: 800; padding: .8rem; }
</style>
