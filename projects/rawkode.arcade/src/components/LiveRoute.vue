<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import BroadcastDisplay from "@/components/BroadcastDisplay.vue";
import LiveGameRoom from "@/components/LiveGameRoom.vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import {
	consumeBootstrap,
	joinBootstrapKey,
	requestJoin,
	type ArcadeRole,
	type RoomBootstrap,
} from "@/lib/room-bootstrap";
import { css } from "@/../styled-system/css";
import { control, shell, slug, text } from "@/styles/arcade";

const joining = css({
	display: "grid",
	justifyItems: "center",
	alignContent: "center",
	gap: "4",
	minHeight: "route",
	textAlign: "center",
	py: "section",
});

type DesiredRole = "contestant" | "audience" | "display";
const props = defineProps<{ code: string; game: GameId; role: DesiredRole }>();
const bootstrap = ref<RoomBootstrap>();
const error = ref("");
const targetRole: ArcadeRole =
	props.role === "contestant" ? "player" : props.role;

async function join() {
	const stored = consumeBootstrap(
		joinBootstrapKey,
		(value) => value.code === props.code && value.role === targetRole,
	);
	try {
		const player = JSON.parse(
			sessionStorage.getItem("rawkode-arcade-player") ?? "{}",
		) as { name?: string; teamId?: string };
		const joined =
			stored ??
			(await requestJoin(props.code, {
				displayName: player.name,
				teamId: player.teamId,
				desiredRole: targetRole,
			}));
		if (joined.role !== targetRole)
			throw new Error("This room code is not valid for that live role.");
		bootstrap.value = joined;
		await nextTick();
		// The island has read the ticket. Do not retain it in route state.
		bootstrap.value = { ...joined, wsTicket: "" };
	} catch (cause) {
		error.value =
			cause instanceof Error ? cause.message : "Unable to join the room.";
	}
}
onMounted(join);
</script>

<template>
	<BroadcastDisplay
		v-if="bootstrap && role === 'display'"
		:room-id="bootstrap.roomId"
		:room-code="code"
		:game="gameById(game).id"
		:ticket="bootstrap.wsTicket"
		:socket-url="bootstrap.socketUrl"
		:view-role="bootstrap.role"
	/>
	<LiveGameRoom
		v-else-if="bootstrap"
		:room-id="bootstrap.roomId"
		:room-code="code"
		:game="gameById(game).id"
		:ticket="bootstrap.wsTicket"
		:socket-url="bootstrap.socketUrl"
		:view-role="bootstrap.role"
		:role="role === 'contestant' ? 'contestant' : role"
	/>
	<section v-else :class="[shell, joining]" :aria-busy="!error" aria-live="polite">
		<span :class="slug({ tone: error ? 'closed' : 'live' })">
			{{ error ? "Cannot join" : "Connecting" }}
		</span>
		<h1 :class="text({ style: 'headline' })">
			{{ error || "Joining the live room" }}
		</h1>
		<a v-if="error" :class="control({ tone: 'quiet' })" href="/join">Try another code</a>
	</section>
</template>
