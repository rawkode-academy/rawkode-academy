<script setup lang="ts">
import { computed } from "vue";
import GameBoard from "@/components/GameBoard.vue";
import { useRoomSocket } from "@/composables/use-room-socket";
import type { GameId } from "@/lib/game-catalogue";
import type { ScopedViewRole } from "@/lib/view-scope";
import {
	castBar,
	castBody,
	castPrompt,
	castScores,
	castStage,
} from "@/styles/broadcast";

/**
 * The stream output.
 *
 * This is deliberately NOT LiveGameRoom with different padding. It is read at
 * one to three metres through a 720p encoder, so it uses the vmin-based
 * broadcast scale, 2px rules, and only two text tones. It also keeps the
 * bottom `castLower` band clear for the stream's lower third.
 */
const props = withDefaults(
	defineProps<{
		game?: GameId;
		roomId?: string;
		roomCode?: string;
		ticket?: string;
		socketUrl?: string;
		viewRole?: ScopedViewRole;
	}>(),
	{ game: "merge-conflict" },
);

const { room, connection, gameDefinition } = useRoomSocket({
	game: props.game,
	roomId: props.roomId,
	roomCode: props.roomCode,
	ticket: props.ticket,
	socketUrl: props.socketUrl,
	viewRole: props.viewRole,
});

const bar = computed(() =>
	castBar({ state: connection === "connected" ? "open" : "closed" }),
);

/** The broadcast must honour every format's advertised team capacity. */
const visibleTeams = computed(() => room.value.teams);
const leadScore = computed(() =>
	visibleTeams.value.reduce((top, team) => Math.max(top, team.score), 0),
);

function scoreSlots(score: number) {
	return castScores({
		position: score === leadScore.value && leadScore.value > 0 ? "leading" : "default",
	});
}
</script>

<template>
	<div :class="castStage">
		<header :class="bar.root">
			<span :class="bar.group">
				<span :class="bar.tally">{{ connection === "connected" ? "On air" : "Off air" }}</span>
				<span :class="bar.label">{{ gameDefinition.title }}</span>
			</span>
			<span :class="bar.group">
				<span :class="bar.label" data-testid="room-phase">{{ room.phase }}</span>
				<span :class="bar.label">
					Round {{ room.questionNumber }} / {{ room.questionTotal }}
				</span>
				<span :class="bar.tally" data-testid="room-code">{{ room.roomCode }}</span>
			</span>
		</header>

		<div :class="castBody" data-testid="question">
			<GameBoard :game="gameDefinition.id" :room="room" scale="cast" />
			<p :class="castPrompt">{{ room.prompt?.text }}</p>
			<p v-if="room.revealedAnswer" :class="castPrompt" data-testid="revealed-answer">
				{{ room.revealedAnswer }}
			</p>
			<p v-if="room.buzzerWinner" :class="castPrompt" data-testid="buzzer-winner">
				Buzzer: {{ room.buzzerWinner }}
			</p>
			<p
				v-if="room.phase === 'complete'"
				:class="castPrompt"
				data-testid="game-complete"
				aria-live="polite"
			>
				Game complete.
			</p>
		</div>

		<footer :class="scoreSlots(-1).root">
			<div
				v-for="team in visibleTeams"
				:key="team.id"
				:class="scoreSlots(team.score).row"
			>
				<span :class="scoreSlots(team.score).name">{{ team.name }}</span>
				<span :class="scoreSlots(team.score).score" :data-testid="`score-${team.id}`">
					{{ team.score.toLocaleString("en-GB") }}
				</span>
			</div>
		</footer>
	</div>
</template>
