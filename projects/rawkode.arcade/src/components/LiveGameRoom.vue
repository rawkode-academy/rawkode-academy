<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AudienceControls from "@/components/AudienceControls.vue";
import ConnectionPill from "@/components/ConnectionPill.vue";
import GameBoard from "@/components/GameBoard.vue";
import TeamRail from "@/components/TeamRail.vue";
import { useRoomSocket } from "@/composables/use-room-socket";
import type { GameId } from "@/lib/game-catalogue";
import { allowsMultipleSubmissions } from "@/lib/submission-policy";
import type { ScopedViewRole } from "@/lib/view-scope";
import { css } from "@/../styled-system/css";
import {
	choice,
	choiceKey,
	control,
	notice,
	row,
	scoreboard,
	shell,
	slug,
	stack,
	stage,
	statusDot,
	text,
} from "@/styles/arcade";

const layout = css({
	display: "grid",
	gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, token(sizes.rail))" },
	overflowWrap: "anywhere",
	gap: "stack",
	py: "stackSm",
	alignItems: "start",
});
const stageMeta = css({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "3",
	pb: "3",
	borderBottomWidth: "hairline",
	borderBottomStyle: "solid",
	borderBottomColor: "rule",
});
const gameTitle = css({ mt: "2" });
const roomCode = css({ minWidth: "0", overflowWrap: "anywhere" });
const progressBlock = css({ display: "grid", gap: "2" });
const progressTrack = css({
	height: "1",
	bg: "surfaceRaised",
	borderRadius: "pill",
	overflow: "hidden",
});
const progressFill = css({
	display: "block",
	height: "full",
	bg: "live",
	transitionProperty: "size",
	transitionDuration: "base",
	transitionTimingFunction: "standard",
});
const answerGrid = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
	gap: "2",
});
const crowdPanel = css({ display: "grid", gap: "1" });
const buzzer = css({ minHeight: "6", py: "4" });

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
const progressPercent = computed(() =>
	Math.round((room.value.questionNumber / room.value.questionTotal) * 100),
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
	<div :class="[shell, layout]">
		<section :class="[stage({ pad: 'comfortable' }), stack({ gap: 'loose' })]" data-stage aria-label="Live game stage">
			<div :class="stageMeta">
				<span :class="slug({ tone: 'live' })">
					<i :class="statusDot({ pulse: true })" aria-hidden="true" />
					Live · <b :class="roomCode" data-testid="room-code">{{ room.roomCode }}</b>
				</span>
				<ConnectionPill :state="connection" />
				<button
					v-if="connection !== 'connected'"
					:class="control({ tone: 'quiet', size: 'sm' })"
					data-control
					type="button"
					@click="reconnect()"
				>
					Retry connection
				</button>
			</div>

			<div>
				<span :class="slug()">{{ gameDefinition.mechanic }}</span>
				<h1 :class="[text({ style: 'headline' }), gameTitle]">{{ gameDefinition.title }}</h1>
			</div>

			<div :class="progressBlock">
				<div :class="row({ justify: 'between' })">
					<span :class="slug()" data-testid="room-phase" aria-live="polite">{{ room.phase }}</span>
					<span :class="slug()">
						Round {{ room.questionNumber }} of {{ room.questionTotal }}
					</span>
				</div>
				<div
					:class="progressTrack"
					role="progressbar"
					:aria-valuenow="room.questionNumber"
					:aria-valuemin="0"
					:aria-valuemax="room.questionTotal"
					:aria-label="`Round ${room.questionNumber} of ${room.questionTotal}`"
				>
					<i :class="progressFill" :style="{ inlineSize: `${progressPercent}%` }" />
				</div>
			</div>

			<div :class="[stage({ tone: 'raised', pad: 'base' }), stack({ gap: 'base' })]" data-stage data-testid="question">
				<span :class="slug()">{{ room.prompt?.label }}</span>
				<h2 :class="text({ style: 'title' })">{{ room.prompt?.text }}</h2>

				<GameBoard :game="gameDefinition.id" :room="room" scale="live" />

				<div
					v-if="gameDefinition.id === 'principal-engineer' && room.principalEngineer && (room.principalEngineer.fiftyFiftyActive || room.principalEngineer.askAudienceActive)"
					:class="notice({ tone: 'live' })"
					data-testid="principal-lifeline-effect"
				>
					<span v-if="room.principalEngineer.fiftyFiftyActive">
						50:50 removed {{ room.principalEngineer.eliminatedChoiceIds.length }} options.
					</span>
					<span v-if="room.principalEngineer.askAudienceActive">
						Audience advice ·
						<template v-if="Object.keys(room.principalEngineer.audienceAdvice).length">
							<b v-for="(count, key) in room.principalEngineer.audienceAdvice" :key="key">
								{{ key }}: {{ count }}
							</b>
						</template>
						<template v-else>awaiting audience votes</template>
					</span>
				</div>

				<div :class="answerGrid" role="group" aria-label="Current answer choices">
					<div
						v-for="(item, index) in room.prompt?.choices"
						:key="item.id"
						:class="choice({ state: 'idle' })"
					>
						<b :class="choiceKey">{{ String.fromCharCode(65 + index) }}</b>
						<span>{{ item.label }}</span>
						<em v-if="role === 'display' && item.votes" :class="slug({ tone: 'crowd' })">
							{{ item.votes }} votes
						</em>
					</div>
				</div>

				<p v-if="room.revealedAnswer" :class="notice({ tone: 'info' })" data-testid="revealed-answer">
					{{ room.revealedAnswer }}
				</p>
				<p v-if="room.buzzerWinner" :class="notice({ tone: 'live' })" data-testid="buzzer-winner">
					Buzzer: {{ room.buzzerWinner }}
				</p>
				<div
					v-if="room.audienceDistribution"
					:class="[notice({ tone: 'info' }), row({ gap: 'tight', wrap: true })]"
					data-testid="audience-distribution"
				>
					<span :class="slug({ tone: 'crowd' })">
						Audience frozen ·
						{{ Object.values(room.audienceDistribution).reduce((sum, count) => sum + count, 0) }}
						responses
					</span>
					<span
						v-for="(count, answer) in room.audienceDistribution"
						:key="answer"
						:class="text({ style: 'bodySm' })"
						:data-testid="`audience-bin-${String(answer).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`"
					>{{ answer }}: {{ count }}</span>
				</div>
				<p v-if="lastError" :class="notice({ tone: 'error' })" role="status" aria-live="polite">
					{{ lastError }}
				</p>
				<p
					v-if="room.phase === 'complete'"
					:class="notice({ tone: 'live' })"
					data-testid="game-complete"
					aria-live="polite"
				>
					Game complete. Final scores are live.
				</p>
			</div>

			<TeamRail :teams="room.teams" />
		</section>

		<aside v-if="role !== 'display'" :class="stack({ gap: 'base' })">
			<div :class="[stage({ pad: 'base' }), crowdPanel]" data-stage>
				<span :class="slug({ tone: 'crowd' })">In the room</span>
				<strong :class="text({ style: 'tally', tone: 'crowd' })">
					{{ room.audienceCount.toLocaleString("en-GB") }}
				</strong>
				<span :class="text({ style: 'bodySm', tone: 'soft' })">
					engineers playing along
				</span>
			</div>

			<section
				v-if="role === 'contestant'"
				:class="[stage({ tone: 'live', pad: 'base' }), stack({ gap: 'snug' })]"
				data-stage
				aria-label="Contestant buzzer"
			>
				<span :class="slug({ tone: 'live' })">Contestant console</span>
				<button
					:class="[control({ tone: 'live' }), buzzer]"
					type="button"
					data-testid="buzzer"
					data-control
					:disabled="connection !== 'connected' || !room.prompt"
					@click="buzz"
				>
					Buzz in
				</button>
				<span :class="text({ style: 'bodySm', tone: 'soft' })">
					One press is sent to the room. The host decides the order.
				</span>
			</section>

			<AudienceControls
				:prompt="room.prompt"
				:disabled="connection !== 'connected' || (role === 'audience' && room.audienceFrozen)"
				:allow-multiple="allowMultipleSubmissions"
				:submitted-prompt-id="submittedPromptId"
				:submitting="isSubmitting"
				@answer="submit"
				@reaction="(reaction) => send('audience.reaction', { reaction, promptId: room.prompt?.id })"
			/>
		</aside>
	</div>
</template>
