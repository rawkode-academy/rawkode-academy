<script setup lang="ts">
import { computed, ref } from "vue";
import ConnectionPill from "@/components/ConnectionPill.vue";
import TeamRail from "@/components/TeamRail.vue";
import { useRoomSocket } from "@/composables/use-room-socket";
import type { GameId } from "@/lib/game-catalogue";
import { css } from "@/../styled-system/css";
import {
	control,
	field,
	fieldLabel,
	notice,
	row,
	slug,
	stack,
	shellWide,
	stage,
	statusDot,
	text,
} from "@/styles/arcade";

const deck = css({ display: "grid", gap: "stackSm", py: "stackSm" });
const deckHeader = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "3",
	pb: "3",
	borderBottomWidth: "rule",
	borderBottomStyle: "solid",
	borderBottomColor: "ruleStrong",
});
const roomTitle = css({
	fontFamily: "mono",
	fontSize: "tally",
	fontWeight: "semibold",
	letterSpacing: "code",
	color: "ink",
	fontVariantNumeric: "tabular-nums",
});
const grid = css({
	display: "grid",
	gridTemplateColumns: {
		base: "1fr",
		md: "repeat(2, minmax(0, 1fr))",
		xl: "repeat(3, minmax(0, 1fr))",
	},
	gap: "4",
	alignItems: "start",
});
const span2 = css({ gridColumn: { base: "auto", md: "span 2" } });
const actions = css({ display: "flex", flexWrap: "wrap", gap: "2" });
const panelHead = css({
	display: "block",
	pb: "3",
	mb: "3",
	borderBottomWidth: "hairline",
	borderBottomStyle: "solid",
	borderBottomColor: "rule",
});
const inviteRow = css({
	display: "grid",
	gridTemplateColumns: "1fr auto auto",
	alignItems: "center",
	gap: "2",
	py: "2",
	borderBottomWidth: "hairline",
	borderBottomStyle: "solid",
	borderBottomColor: "rule",
});
const inviteCode = css({
	fontFamily: "mono",
	fontSize: "bodySm",
	letterSpacing: "label",
	color: "live",
});
const bigNumber = css({
	fontFamily: "mono",
	fontSize: "tally",
	fontWeight: "semibold",
	color: "crowd",
	fontVariantNumeric: "tabular-nums",
	lineHeight: "flat",
});
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
	<div :class="[shellWide, deck]">
		<header :class="deckHeader">
			<div :class="stack({ gap: 'tight' })">
				<span :class="slug({ tone: 'live' })">
					<i :class="statusDot({ pulse: true })" aria-hidden="true" />
					Producer control
				</span>
				<span :class="roomTitle" data-testid="room-code">{{ room.roomCode }}</span>
				<span :class="slug()">{{ room.game }}</span>
			</div>
			<div :class="row({ gap: 'base' })">
				<output
					v-if="hostPrivateMarker"
					:class="notice({ tone: 'live' })"
					data-testid="host-private-answer"
				>{{ hostPrivateMarker }}</output>
				<ConnectionPill :state="connection" />
			</div>
		</header>

		<div :class="grid">
			<section :class="[stage({ tone: 'raised', pad: 'base' }), span2]" data-stage>
				<span :class="[slug({ tone: 'live' }), panelHead]">On programme</span>
				<h2 :class="text({ style: 'title' })" tabindex="-1">{{ room.prompt?.text }}</h2>
				<div :class="[row({ gap: 'base', wrap: true }), css({ mt: '3' })]">
					<span :class="slug()" data-testid="room-phase" aria-live="polite">{{ room.phase }}</span>
					<span :class="slug({ tone: 'crowd' })">
						{{ room.audienceCount.toLocaleString("en-GB") }} audience
					</span>
				</div>
				<p
					v-if="room.phase === 'complete'"
					:class="[notice({ tone: 'live' }), css({ mt: '3' })]"
					data-testid="game-complete"
					aria-live="polite"
				>
					Game complete. Results projected.
				</p>
			</section>

			<section :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Round controls</span>
				<div :class="actions">
					<button
						v-if="room.phase === 'lobby'"
						:class="control({ tone: 'live', size: 'sm' })"
						type="button"
						data-control
						data-testid="start-game"
						@click="send('room.start')"
					>Start game</button>
					<button
						v-else
						:class="control({ tone: 'live', size: 'sm' })"
						type="button"
						data-control
						data-testid="advance-phase"
						@click="send('phase.advance')"
					>Next prompt</button>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="reveal-answer"
						:disabled="!canReveal"
						@click="send('prompt.reveal')"
					>Reveal results</button>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="freeze-distribution"
						:disabled="!canFreeze"
						@click="send('audience.freeze')"
					>Freeze audience</button>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="host-correct"
						@click="send('score.correct')"
					>Correct score</button>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						@click="pause"
					>{{ paused ? "Resume clock" : "Pause clock" }}</button>
					<button
						:class="control({ tone: 'danger', size: 'sm' })"
						type="button"
						data-control
						data-testid="complete-game"
						@click="send('room.complete')"
					>Complete game</button>
				</div>
				<p :class="[text({ style: 'bodySm', tone: 'mute' }), css({ mt: '3' })]">
					Controls dispatch server-authorised envelopes only. Scores and answers
					stay private to the room.
				</p>
			</section>

			<section :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Room assembly</span>
				<div :class="stack({ gap: 'snug' })">
					<div>
						<label :class="fieldLabel" for="host-team-id">Team ID</label>
						<input
							id="host-team-id"
							v-model="activeTeamId"
							:class="field()"
							data-field
							data-testid="host-team-id"
							autocomplete="off"
						/>
					</div>
					<div>
						<label :class="fieldLabel" for="host-team-name">Team name</label>
						<input
							id="host-team-name"
							v-model="teamName"
							:class="field()"
							data-field
							data-testid="host-team-name"
							maxlength="80"
						/>
					</div>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="add-team"
						@click="addTeam"
					>Add team</button>
				</div>
			</section>

			<section :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Invite codes</span>
				<div v-for="inviteRole in inviteRoles" :key="inviteRole" :class="inviteRow">
					<span :class="text({ style: 'bodySm' })">{{ inviteRole }}</span>
					<code v-if="inviteCodes[inviteRole]" :class="inviteCode" :data-testid="`${inviteRole}-invite-code`">
						{{ inviteCodes[inviteRole] }}
					</code>
					<span v-else :class="slug()">none</span>
					<button
						v-if="inviteCodes[inviteRole]"
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						:data-testid="`copy-${inviteRole}-invite`"
						@click="copyInvite(inviteRole)"
					>Copy</button>
					<button
						v-else
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						:data-testid="`mint-${inviteRole}-invite`"
						@click="mintInvite(inviteRole)"
					>Create</button>
				</div>
				<p :class="[slug(), css({ mt: '3' })]" aria-live="polite">{{ inviteStatus }}</p>
			</section>

			<section v-if="room.game === 'spinlock'" :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Spinlock console</span>
				<div :class="stack({ gap: 'snug' })">
					<button
						:class="control({ tone: 'live', size: 'sm' })"
						type="button"
						data-control
						data-testid="spin-wheel"
						@click="spin"
					>Spin wheel</button>
					<div>
						<label :class="fieldLabel" for="spin-letter">Letter</label>
						<input
							id="spin-letter"
							v-model="letter"
							:class="field()"
							data-field
							data-testid="spin-letter"
							maxlength="1"
							autocomplete="off"
						/>
					</div>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="guess-letter"
						@click="guessLetter"
					>Guess letter</button>
				</div>
			</section>

			<section v-if="room.game === 'principal-engineer'" :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Lifelines</span>
				<div :class="actions">
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="lifeline-fifty-fifty"
						:disabled="room.principalEngineer?.fiftyFiftyUsed"
						@click="lifeline('fifty-fifty')"
					>50:50</button>
					<button
						:class="control({ tone: 'quiet', size: 'sm' })"
						type="button"
						data-control
						data-testid="lifeline-ask-audience"
						:disabled="room.principalEngineer?.askAudienceUsed"
						@click="lifeline('ask-audience')"
					>Ask audience</button>
				</div>
			</section>

			<section v-if="room.game === 'race-condition'" :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Chaser console</span>
				<div :class="stack({ gap: 'snug' })">
					<div>
						<label :class="fieldLabel" for="chaser-answer">Chaser answer</label>
						<input
							id="chaser-answer"
							v-model="chaserAnswer"
							:class="field()"
							data-field
							data-testid="chaser-answer"
							autocomplete="off"
						/>
					</div>
					<button
						:class="control({ tone: 'live', size: 'sm' })"
						type="button"
						data-control
						data-testid="submit-chaser-answer"
						@click="moveChaser"
					>Move chaser</button>
				</div>
			</section>

			<section :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug(), panelHead]">Live teams</span>
				<TeamRail :teams="room.teams" compact />
			</section>

			<section :class="stage({ pad: 'base' })" data-stage>
				<span :class="[slug({ tone: 'crowd' }), panelHead]">Audience activity</span>
				<div :class="bigNumber">{{ room.audienceCount.toLocaleString("en-GB") }}</div>
				<p :class="text({ style: 'bodySm', tone: 'soft' })" data-testid="audience-aggregate">
					{{ room.audienceResponseCount }} authoritative responses aggregated
				</p>
			</section>
		</div>
	</div>
</template>
