<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AudienceControls from "@/components/AudienceControls.vue";
import ConnectionPill from "@/components/ConnectionPill.vue";
import TeamRail from "@/components/TeamRail.vue";
import { useRoomSocket } from "@/composables/use-room-socket";
import type { GameId } from "@/lib/game-catalogue";
import { allowsMultipleSubmissions } from "@/lib/submission-policy";
import type { ScopedViewRole } from "@/lib/view-scope";
import { arcadeShell, arcadeStage, gameTheme } from "@/styles/arcade";

const props = withDefaults(
	defineProps<{
		game?: GameId;
		role?: "audience" | "contestant" | "display";
		roomId?: string;
		roomCode?: string;
		ticket?: string;
		socketUrl?: string;
		viewRole?: ScopedViewRole;
		displayName?: string;
		teamId?: string;
	}>(),
	{ game: "merge-conflict", role: "audience" },
);
const {
	room,
	connection,
	gameDefinition,
	lastError,
	lastErrorCommandId,
	lastAcceptedCommandId,
	send,
	reconnect,
} =
	useRoomSocket({
		game: props.game,
		roomId: props.roomId,
		roomCode: props.roomCode,
		ticket: props.ticket,
		socketUrl: props.socketUrl,
		viewRole: props.viewRole,
	});
const progress = computed(
	() => `${(room.value.questionNumber / room.value.questionTotal) * 100}%`,
);
const pendingSubmission = ref<{ commandId: string; promptId: string }>();
const submittedPromptId = ref("");
const isSubmitting = computed(
	() => pendingSubmission.value?.promptId === room.value.prompt?.id,
);
const allowMultipleSubmissions = computed(() =>
	allowsMultipleSubmissions(props.role, gameDefinition.value.id),
);
watch(lastAcceptedCommandId, (commandId) => {
	if (commandId && commandId === pendingSubmission.value?.commandId) {
		submittedPromptId.value = pendingSubmission.value.promptId;
		pendingSubmission.value = undefined;
	}
});
watch(lastErrorCommandId, (commandId) => {
	if (commandId && commandId === pendingSubmission.value?.commandId)
		pendingSubmission.value = undefined;
});
watch(
	() => room.value.prompt?.id,
	() => {
		pendingSubmission.value = undefined;
	},
);
const player = () => {
	if (typeof sessionStorage === "undefined")
		return { displayName: props.displayName, teamId: props.teamId };
	let stored: { name?: string; teamId?: string } = {};
	try {
		stored = JSON.parse(
			sessionStorage.getItem("rawkode-arcade-player") ?? "{}",
		) as { name?: string; teamId?: string };
	} catch {
		/* invalid local player state is ignored */
	}
	return {
		displayName: props.displayName ?? stored.name,
		teamId: props.teamId ?? stored.teamId,
	};
};
const buzz = () => {
	if (room.value.prompt)
		send("buzzer.press", {
			promptId: room.value.prompt.id,
			displayName: player().displayName,
		});
};
const submit = (input: { choiceId?: string; answer?: string }) => {
	if (room.value.prompt)
		if (props.role === "audience") {
			const choice = input.choiceId ?? input.answer;
			if (choice) {
				const command = send("audience.vote", {
					promptId: room.value.prompt.id,
					choice,
				});
				if (command?.id)
					pendingSubmission.value = {
						commandId: command.id,
						promptId: room.value.prompt.id,
					};
			}
		} else
			{
				const command = send("answer.submit", {
				promptId: room.value.prompt.id,
				teamId: player().teamId,
				...input,
				});
				if (command?.id)
					pendingSubmission.value = {
						commandId: command.id,
						promptId: room.value.prompt.id,
					};
			}
};
</script>
<template>
	<div :class="[arcadeShell, 'live-room', `game-${gameDefinition.id}`, `role-${role}`]">
		<section :class="[arcadeStage, gameTheme({ game: gameDefinition.id }), 'game-stage']" aria-label="Live game stage">
			<div class="stage-meta"><span class="live-label"><i></i> Live room · <b data-testid="room-code">{{ room.roomCode }}</b></span><ConnectionPill :state="connection" /><button v-if="connection !== 'connected'" class="reconnect" @click="reconnect()">Retry connection</button></div>
			<div class="game-identity"><span>{{ gameDefinition.kicker }}</span><h1>{{ gameDefinition.title }}</h1><p>{{ gameDefinition.mechanic }}</p></div>
			<div class="round-progress"><span data-testid="room-phase" aria-live="polite">{{ room.phase }}</span><span>Round {{ room.questionNumber }} / {{ room.questionTotal }}</span><div><i :style="{ width: progress }"></i></div></div>
			<div class="prompt-card" data-testid="question">
				<span class="prompt-label">{{ room.prompt?.label }}</span>
				<h2>{{ room.prompt?.text }}</h2>
				<div v-if="gameDefinition.id === 'spinlock'" class="spin-board" data-testid="spin-board"><output class="spin-mask" aria-label="Current phrase board">{{ room.spinlock?.board ?? 'Waiting for the first round' }}</output><div class="spin-letters" aria-label="Guessed letters"><span v-if="!room.spinlock?.letters.length">No letters revealed</span><b v-for="letter in room.spinlock?.letters" :key="letter" :data-testid="`spin-letter-${letter}`">{{ letter }}</b></div><small data-testid="spin-value">Wheel value · {{ room.spinlock?.activeValue ?? 0 }} · Turn {{ (room.spinlock?.turn ?? 0) + 1 }}</small></div>
				<div v-if="gameDefinition.id === 'principal-engineer' && room.principalEngineer && (room.principalEngineer.fiftyFiftyActive || room.principalEngineer.askAudienceActive)" class="lifeline-effect" data-testid="principal-lifeline-effect"><span v-if="room.principalEngineer.fiftyFiftyActive">50:50 removed {{ room.principalEngineer.eliminatedChoiceIds.length }} options.</span><span v-if="room.principalEngineer.askAudienceActive">Audience advice · <template v-if="Object.keys(room.principalEngineer.audienceAdvice).length"><b v-for="(count, choice) in room.principalEngineer.audienceAdvice" :key="choice">{{ choice }}: {{ count }}</b></template><template v-else>awaiting audience votes</template></span></div>
				<div class="answer-grid" role="group" aria-label="Current answer choices">
					<div v-for="(choice, index) in room.prompt?.choices" :key="choice.id" class="answer-preview"><b>{{ String.fromCharCode(65 + index) }}</b><span>{{ choice.label }}</span><em v-if="role === 'display' && choice.votes">{{ choice.votes }} votes</em></div>
				</div>
				<p v-if="room.revealedAnswer" class="revealed-answer" data-testid="revealed-answer">{{ room.revealedAnswer }}</p>
				<p v-if="room.buzzerWinner" class="buzzer-winner" data-testid="buzzer-winner">Buzzer: {{ room.buzzerWinner }}</p>
				<div v-if="room.audienceDistribution" class="audience-distribution" data-testid="audience-distribution">Audience distribution frozen · {{ Object.values(room.audienceDistribution).reduce((sum, count) => sum + count, 0) }} responses <span v-for="(count, answer) in room.audienceDistribution" :key="answer" :data-testid="`audience-bin-${String(answer).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`">{{ answer }}: {{ count }}</span></div>
				<p v-if="lastError" class="command-error" role="status" aria-live="polite">{{ lastError }}</p>
				<p v-if="room.phase === 'complete'" class="game-complete" data-testid="game-complete" aria-live="polite">Game complete · final scores are live.</p>
			</div>
			<TeamRail class="stage-teams" :teams="room.teams" />
		</section>
		<aside v-if="role !== 'display'" class="side-panel">
			<div class="watching"><span>LIVE PARTICIPANTS</span><strong>{{ room.audienceCount.toLocaleString() }}</strong><small>developers in the room</small></div>
			<section v-if="role === 'contestant'" class="buzzer" aria-label="Contestant buzzer"><span>Your contestant console</span><button data-testid="buzzer" :disabled="connection !== 'connected' || !room.prompt" @click="buzz"><i aria-hidden="true">⚡</i> BUZZ IN</button><small>One press is sent to the live room. The host decides the order.</small></section>
			<AudienceControls :prompt="room.prompt" :disabled="connection !== 'connected' || (role === 'audience' && room.audienceFrozen)" :allow-multiple="allowMultipleSubmissions" :submitted-prompt-id="submittedPromptId" :submitting="isSubmitting" @answer="submit" @reaction="(reaction) => send('audience.reaction', { reaction, promptId: room.prompt?.id })" />
		</aside>
	</div>
</template>
<style scoped>
.live-room { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr) 330px; margin: 0 auto; max-width: 1320px; padding: 2rem; }.game-stage { background: radial-gradient(circle at 84% 8%, rgb(77 232 255 / 19%), transparent 27%), linear-gradient(145deg, #15234a, #0b1229 70%); border: 1px solid var(--line); border-radius: 20px; min-height: 650px; overflow: hidden; padding: clamp(1.2rem, 4vw, 2.6rem); position: relative; }.game-stage::before { background-image: linear-gradient(rgb(174 187 217 / 5%) 1px, transparent 1px), linear-gradient(90deg, rgb(174 187 217 / 5%) 1px, transparent 1px); background-size: 28px 28px; content: ""; inset: 0; mask-image: linear-gradient(to bottom, black, transparent 65%); pointer-events: none; position: absolute; }.stage-meta, .round-progress { align-items: center; color: var(--mist); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .65rem; justify-content: space-between; letter-spacing: .08em; position: relative; text-transform: uppercase; z-index: 1; }.live-label { align-items: center; display: flex; gap: .45rem; }.live-label i { animation: blink 1.1s infinite; background: var(--coral); border-radius: 50%; height: 8px; width: 8px; }.reconnect { background: transparent; border: 1px solid var(--amber); border-radius: 7px; color: var(--amber); font-size: .65rem; margin-left: auto; padding: .3rem .45rem; }.game-identity { margin: clamp(3rem, 8vw, 6.5rem) 0 2.3rem; position: relative; text-align: center; z-index: 1; }.game-identity span { color: var(--cyan); font-family: "IBM Plex Mono", monospace; font-size: .7rem; letter-spacing: .16em; text-transform: uppercase; }.game-identity h1 { font-family: "Space Grotesk", sans-serif; font-size: clamp(2.25rem, 6vw, 5.5rem); letter-spacing: -.08em; line-height: .88; margin: .6rem auto; max-width: 12ch; }.game-identity p { color: var(--mist); font-size: .82rem; margin: 0; }.round-progress { gap: 1rem; }.round-progress > div { background: rgb(174 187 217 / 13%); border-radius: 999px; flex: 1; height: 6px; max-width: 310px; overflow: hidden; }.round-progress i { background: var(--cyan); border-radius: inherit; display: block; height: 100%; }.prompt-card { background: rgb(8 13 29 / 57%); border: 1px solid rgb(174 187 217 / 18%); border-radius: 16px; margin: 1.2rem auto; max-width: 790px; padding: clamp(1rem, 3vw, 1.8rem); position: relative; z-index: 1; }.prompt-label { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .65rem; letter-spacing: .08em; text-transform: uppercase; }.prompt-card h2 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.3rem, 2.7vw, 2rem); letter-spacing: -.05em; line-height: 1.07; margin: .6rem 0 1.25rem; }.answer-grid { display: grid; gap: .6rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }.answer-preview { align-items: center; background: rgb(174 187 217 / 6%); border: 1px solid var(--line); border-radius: 9px; display: flex; font-size: .8rem; gap: .6rem; min-height: 45px; padding: .55rem; }.answer-preview b { align-items: center; background: rgb(77 232 255 / 13%); border-radius: 5px; color: var(--cyan); display: inline-flex; font-family: "IBM Plex Mono", monospace; font-size: .65rem; height: 25px; justify-content: center; width: 25px; }.answer-preview em { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .6rem; font-style: normal; margin-left: auto; }.stage-teams { bottom: 1.25rem; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); left: 1.25rem; position: absolute; right: 1.25rem; z-index: 1; }.side-panel { display: grid; align-content: start; gap: .9rem; }.watching { background: rgb(24 38 74 / 55%); border: 1px solid var(--line); border-radius: 12px; padding: .9rem; }.watching span { color: var(--mist); display: block; font-family: "IBM Plex Mono", monospace; font-size: .6rem; letter-spacing: .08em; }.watching strong { color: var(--lime); display: inline-block; font-family: "Space Grotesk", sans-serif; font-size: 2rem; letter-spacing: -.07em; margin: .35rem .4rem .1rem 0; }.watching small { color: var(--mist); font-size: .7rem; }.buzzer { background: linear-gradient(145deg, rgb(255 107 122 / 19%), rgb(16 26 53 / 90%)); border: 1px solid rgb(255 107 122 / 45%); border-radius: 12px; padding: .9rem; }.buzzer span, .buzzer small { color: var(--mist); display: block; font-family: "IBM Plex Mono", monospace; font-size: .58rem; letter-spacing: .07em; text-transform: uppercase; }.buzzer button { background: var(--coral); border: 0; border-radius: 9px; box-shadow: 0 5px 0 #a93242; color: var(--ink); font-family: "Space Grotesk", sans-serif; font-size: 1.2rem; font-weight: 800; letter-spacing: .05em; margin: .7rem 0 .8rem; padding: 1rem; width: 100%; }.buzzer button:active { box-shadow: 0 1px 0 #a93242; transform: translateY(4px); }.buzzer button:disabled { opacity: .45; }.buzzer small { letter-spacing: 0; line-height: 1.45; text-transform: none; }.role-display { display: block; max-width: none; padding: 0; }.role-display .game-stage { border-radius: 0; min-height: 100vh; }.role-display .stage-teams { bottom: 3vw; left: 5vw; right: 5vw; }.role-display .game-identity { margin-top: 10vh; }.game-spinlock .game-stage { background: radial-gradient(circle at 12% 17%, rgb(149 119 255 / 29%), transparent 31%), linear-gradient(145deg, #201947, #0d1029 70%); }.game-principal-engineer .game-stage { background: radial-gradient(circle at 80% 10%, rgb(255 200 87 / 21%), transparent 31%), linear-gradient(145deg, #3b2d10, #111020 70%); }.game-race-condition .game-stage { background: radial-gradient(circle at 85% 10%, rgb(255 107 122 / 22%), transparent 34%), linear-gradient(145deg, #3c1627, #101022 70%); }.game-ten-nines .game-stage { background: radial-gradient(circle at 85% 10%, rgb(201 255 99 / 16%), transparent 30%), linear-gradient(145deg, #173622, #091924 70%); }.game-null-pointer .game-stage { background: radial-gradient(circle at 85% 10%, rgb(255 131 211 / 21%), transparent 32%), linear-gradient(145deg, #351940, #111023 70%); }@keyframes blink { 50% { opacity: .35; } }@media (max-width: 900px) { .live-room { grid-template-columns: 1fr; }.side-panel { grid-template-columns: 1fr 1fr; }.side-panel .leaderboard { display: none; }.game-stage { min-height: 590px; }.stage-teams { position: static; margin-top: 1.2rem; }.game-stage { display: flex; flex-direction: column; }.answer-grid { grid-template-columns: 1fr; } }@media (max-width: 560px) { .live-room { padding: 1rem; }.game-stage { min-height: auto; padding: 1rem; }.game-identity { margin: 2.5rem 0 1.8rem; }.side-panel { display: block; }.side-panel > * + * { margin-top: .9rem; }.stage-teams { grid-template-columns: 1fr; }.role-display .game-stage { min-height: 100vh; } }
</style>
