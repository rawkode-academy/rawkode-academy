<script setup lang="ts">
import { computed, ref } from "vue";
import ConnectionPill from "@/components/ConnectionPill.vue";
import TeamRail from "@/components/TeamRail.vue";
import { useRoomSocket } from "@/composables/use-room-socket";
import type { GameId } from "@/lib/game-catalogue";
import { arcadeCard, arcadeControl } from "@/styles/arcade";
const props = withDefaults(
	defineProps<{
		game?: GameId;
		roomId?: string;
		ticket?: string;
		roomCode?: string;
		socketUrl?: string;
	}>(),
	{ game: "merge-conflict" },
);
const { room, connection, hostPrivateMarker, send } = useRoomSocket({
	game: props.game,
	roomId: props.roomId,
	ticket: props.ticket,
	roomCode: props.roomCode,
	socketUrl: props.socketUrl,
	isHost: true,
});
const paused = ref(false);
const activeTeamId = ref("team-red");
const teamName = ref("The Merge Queue");
const letter = ref("");
const chaserAnswer = ref("");
const inviteStatus = ref("");
const inviteCodes = ref<Record<"player" | "audience" | "display", string>>({
	player: "",
	audience: "",
	display: "",
});
const inviteRoles = ["player", "audience", "display"] as const;
const canReveal = computed(
	() => room.value.phase !== "lobby" && room.value.phase !== "complete",
);
const canFreeze = computed(
	() =>
		canReveal.value &&
		!room.value.audienceFrozen,
);
function pause() {
	paused.value = !paused.value;
	send(paused.value ? "room.pause" : "room.resume");
}
function addTeam() {
	const teamId = activeTeamId.value.trim();
	if (!teamId) return;
	send("team.upsert", { teamId, name: teamName.value.trim() || teamId });
}
async function mintInvite(role: "player" | "audience" | "display") {
	inviteStatus.value = "Creating invite…";
	try {
		const response = await fetch(
			`/api/rooms/${encodeURIComponent(room.value.roomId)}/invite`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ role }),
			},
		);
		if (!response.ok) throw new Error("The room could not create that invite.");
		const value = (await response.json()) as { code?: string };
		if (!value.code) throw new Error("The room returned an invalid invite.");
		inviteCodes.value = { ...inviteCodes.value, [role]: value.code };
		inviteStatus.value = `${role} invite ready.`;
	} catch (cause) {
		inviteStatus.value =
			cause instanceof Error ? cause.message : "Unable to create invite.";
	}
}
async function copyInvite(role: "player" | "audience" | "display") {
	const code = inviteCodes.value[role];
	if (!code) return;
	try {
		await navigator.clipboard.writeText(code);
		inviteStatus.value = `${role} invite copied.`;
	} catch {
		inviteStatus.value = `Copy this ${role} code: ${code}`;
	}
}
function spin() {
	send("spinlock.spin", { teamId: activeTeamId.value });
}
function guessLetter() {
	const value = letter.value.trim().slice(0, 1);
	if (value) send("spinlock.guess-letter", { teamId: activeTeamId.value, letter: value });
}
function lifeline(lifeline: "fifty-fifty" | "ask-audience") {
	send("principal.lifeline", { teamId: activeTeamId.value, lifeline });
}
function moveChaser() {
	if (chaserAnswer.value.trim())
		send("race.chaser-answer", { answer: chaserAnswer.value.trim() });
}
</script>
<template>
	<div class="host-deck">
		<header><div><span>Producer control</span><h1><b data-testid="room-code">{{ room.roomCode }}</b> <b>/ {{ room.game }}</b></h1><output v-if="hostPrivateMarker" class="private-marker" data-testid="host-private-answer">{{ hostPrivateMarker }}</output></div><ConnectionPill :state="connection" /></header>
		<div class="deck-grid">
			<section :class="[arcadeCard({ tone: 'raised' }), 'program', 'card']"><span class="eyebrow">On program</span><h2 tabindex="-1">{{ room.prompt?.text }}</h2><div class="program-status"><i></i> <span data-testid="room-phase" aria-live="polite">{{ room.phase }}</span><b>{{ room.audienceCount.toLocaleString() }} audience</b></div><p v-if="room.phase === 'complete'" data-testid="game-complete" aria-live="polite">Game complete · results projected.</p></section>
			<section :class="[arcadeCard({ tone: 'default' }), 'controls', 'card']"><span class="eyebrow">Round controls</span><div class="actions"><button :class="[arcadeControl({ tone: 'quiet', size: 'sm' }), 'secondary']" @click="pause">{{ paused ? 'Resume' : 'Pause clock' }}</button><button :class="[arcadeControl({ tone: 'outline', size: 'sm' }), 'outline']" data-testid="reveal-answer" :disabled="!canReveal" @click="send('prompt.reveal')">Reveal results</button><button :class="[arcadeControl({ tone: 'outline', size: 'sm' }), 'outline']" data-testid="freeze-distribution" :disabled="!canFreeze" @click="send('audience.freeze')">Freeze audience</button><button :class="[arcadeControl({ tone: 'outline', size: 'sm' }), 'outline']" data-testid="host-correct" @click="send('score.correct')">Correct score</button><button :class="[arcadeControl({ tone: 'outline', size: 'sm' }), 'outline']" data-testid="complete-game" @click="send('room.complete')">Complete game</button><button v-if="room.phase === 'lobby'" :class="[arcadeControl({ tone: 'accent' }), 'primary']" data-testid="start-game" @click="send('room.start')">Start game <span>→</span></button><button v-else :class="[arcadeControl({ tone: 'accent' }), 'primary']" data-testid="advance-phase" @click="send('phase.advance')">Next prompt <span>→</span></button></div><p>Controls dispatch canonical server-authorized envelopes only. Scores and answers remain private to the game room.</p></section>
			<section :class="[arcadeCard({ tone: 'default' }), 'card', 'assembly']"><span class="eyebrow">Room assembly</span><label>Team ID<input v-model="activeTeamId" data-testid="host-team-id" autocomplete="off" /></label><label>Team name<input v-model="teamName" data-testid="host-team-name" maxlength="80" /></label><button :class="arcadeControl({ tone: 'outline', size: 'sm' })" data-testid="add-team" @click="addTeam">Add team</button><div class="invites"><span>Invite codes</span><div v-for="role in inviteRoles" :key="role"><button :data-testid="`mint-${role}-invite`" @click="mintInvite(role)">Create {{ role }}</button><code v-if="inviteCodes[role]" :data-testid="`${role}-invite-code`">{{ inviteCodes[role] }}</code><button v-if="inviteCodes[role]" :data-testid="`copy-${role}-invite`" @click="copyInvite(role)">Copy</button></div></div><p class="invite-status" aria-live="polite">{{ inviteStatus }}</p></section>
			<section v-if="room.game === 'spinlock'" :class="[arcadeCard({ tone: 'default' }), 'card', 'game-controls']"><span class="eyebrow">Spinlock console</span><button :class="arcadeControl({ tone: 'accent', size: 'sm' })" data-testid="spin-wheel" @click="spin">Spin wheel</button><label>Letter<input v-model="letter" data-testid="spin-letter" maxlength="1" autocomplete="off" /></label><button :class="arcadeControl({ tone: 'outline', size: 'sm' })" data-testid="guess-letter" @click="guessLetter">Guess letter</button></section>
			<section v-if="room.game === 'principal-engineer'" :class="[arcadeCard({ tone: 'default' }), 'card', 'game-controls']"><span class="eyebrow">Principal lifelines</span><button :class="arcadeControl({ tone: 'outline', size: 'sm' })" data-testid="lifeline-fifty-fifty" :disabled="room.principalEngineer?.fiftyFiftyUsed" @click="lifeline('fifty-fifty')">50:50</button><button :class="arcadeControl({ tone: 'outline', size: 'sm' })" data-testid="lifeline-ask-audience" :disabled="room.principalEngineer?.askAudienceUsed" @click="lifeline('ask-audience')">Ask audience</button></section>
			<section v-if="room.game === 'race-condition'" :class="[arcadeCard({ tone: 'default' }), 'card', 'game-controls']"><span class="eyebrow">Chaser console</span><label>Chaser answer<input v-model="chaserAnswer" data-testid="chaser-answer" autocomplete="off" /></label><button :class="arcadeControl({ tone: 'accent', size: 'sm' })" data-testid="submit-chaser-answer" @click="moveChaser">Move chaser</button></section>
			<section :class="[arcadeCard({ tone: 'default' }), 'card', 'teams']"><span class="eyebrow">Live teams</span><TeamRail :teams="room.teams" /></section>
			<section :class="[arcadeCard({ tone: 'default' }), 'card', 'activity']"><span class="eyebrow">Audience activity</span><div class="activity-number">{{ room.audienceCount.toLocaleString() }}</div><p data-testid="audience-aggregate">{{ room.audienceResponseCount }} authoritative responses aggregated</p></section>
		</div>
	</div>
</template>
<style scoped>
.host-deck { margin: auto; max-width: 1180px; padding: 2rem; }header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 1.4rem; }header span, .eyebrow { color: var(--cyan); font-family: "IBM Plex Mono", monospace; font-size: .64rem; letter-spacing: .1em; text-transform: uppercase; }h1 { font-family: "Space Grotesk", sans-serif; font-size: 1.5rem; letter-spacing: -.05em; margin: .3rem 0 0; }h1 b { color: var(--mist); font-size: .8rem; font-weight: 500; }.deck-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }.card { background: rgb(16 26 53 / 70%); border: 1px solid var(--line); border-radius: 14px; padding: 1.1rem; }.program { grid-column: span 2; }.program h2 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.3rem, 3vw, 2rem); letter-spacing: -.05em; line-height: 1.1; margin: .7rem 0 1.2rem; max-width: 38ch; }.program-status { align-items: center; color: var(--mist); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .65rem; gap: .45rem; letter-spacing: .06em; text-transform: uppercase; }.program-status i { background: var(--lime); border-radius: 50%; height: 8px; width: 8px; }.program-status b { color: var(--cloud); margin-left: auto; }.actions { display: grid; gap: .55rem; grid-template-columns: 1fr 1fr; margin-top: .8rem; }.actions button { border-radius: 8px; font-size: .78rem; font-weight: 800; min-height: 43px; }.primary { background: var(--cyan); border: 1px solid var(--cyan); color: var(--ink); grid-column: span 2; }.outline { background: transparent; border: 1px solid var(--cyan); color: var(--cyan); }.secondary { background: rgb(174 187 217 / 10%); border: 1px solid var(--line); color: var(--cloud); }.actions button:disabled { cursor: not-allowed; opacity: .4; }.controls p, .activity p { color: var(--mist); font-size: .72rem; line-height: 1.45; margin: .8rem 0 0; }.activity-number { color: var(--lime); font-family: "Space Grotesk", sans-serif; font-size: 3.3rem; font-weight: 700; letter-spacing: -.09em; line-height: 1; margin-top: 1rem; }.assembly, .game-controls { display: grid; gap: .6rem; align-content: start; }.assembly label, .game-controls label { color: var(--mist); display: grid; font-family: "IBM Plex Mono", monospace; font-size: .62rem; gap: .3rem; letter-spacing: .06em; text-transform: uppercase; }.assembly input, .game-controls input { background: rgb(8 13 29 / 60%); border: 1px solid var(--line); border-radius: 7px; color: var(--cloud); padding: .55rem; }.assembly > button, .game-controls > button { justify-content: center; }.invites { border-top: 1px solid var(--line); display: grid; gap: .45rem; margin-top: .3rem; padding-top: .7rem; }.invites > span { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .6rem; letter-spacing: .07em; text-transform: uppercase; }.invites > div { align-items: center; display: grid; gap: .35rem; grid-template-columns: auto 1fr auto; }.invites button { background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--cloud); font-size: .68rem; padding: .35rem .45rem; }.invites code { color: var(--lime); font-size: .65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.invite-status { color: var(--mist); font-size: .68rem; margin: 0; min-height: 1em; }@media (max-width: 660px) { .host-deck { padding: 1rem; }.deck-grid { grid-template-columns: 1fr; }.program { grid-column: auto; }.activity { display: none; } }
</style>
