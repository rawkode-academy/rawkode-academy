<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import HostControlDeck from "@/components/HostControlDeck.vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import {
	consumeBootstrap,
	hostBootstrapKey,
	requestExistingRoom,
	requestJoin,
	type RoomBootstrap,
} from "@/lib/room-bootstrap";

const props = withDefaults(
	defineProps<{ roomId: string; game?: GameId; code?: string }>(),
	{ game: "merge-conflict" },
);
const bootstrap = ref<RoomBootstrap>();
const error = ref("");
const roomGame = ref<GameId>(props.game);

async function loadRoomMetadata(roomId: string) {
	const response = await fetch(
		`/api/rooms/${encodeURIComponent(roomId)}/state`,
		{
			credentials: "same-origin",
		},
	);
	if (!response.ok) return;
	const value = (await response.json()) as { state?: { gameKey?: string } };
	roomGame.value = gameById(value.state?.gameKey).id;
}

async function connectHost() {
	const stored = consumeBootstrap(
		hostBootstrapKey,
		(value) => value.roomId === props.roomId && (value.role === "host" || value.role === "producer"),
	);
	try {
		const joined =
			stored ??
			(props.code ? await requestJoin(props.code, { desiredRole: "host" }) : await requestExistingRoom(props.roomId));
		if (joined.roomId !== props.roomId || (joined.role !== "host" && joined.role !== "producer"))
			throw new Error("This host link is not authorized for the room.");
		await loadRoomMetadata(joined.roomId);
		bootstrap.value = joined;
		await nextTick();
		bootstrap.value = { ...joined, wsTicket: "" };
	} catch (cause) {
		error.value =
			cause instanceof Error
				? cause.message
				: "Unable to open producer controls.";
	}
}
onMounted(connectHost);
</script>
<template>
	<HostControlDeck
		v-if="bootstrap"
		:room-id="bootstrap.roomId"
		:room-code="code ?? roomId"
		:game="roomGame"
		:ticket="bootstrap.wsTicket"
		:socket-url="bootstrap.socketUrl"
	/>
	<section v-else class="joining" :aria-busy="!error" aria-live="polite">
		<h1>{{ error || "Opening producer controls…" }}</h1>
		<p v-if="error"><a href="/">Return to the lobby</a> to create or open a room.</p>
	</section>
</template>
<style scoped>
.joining { align-items: center; display: grid; justify-content: center; min-height: 70vh; padding: 2rem; text-align: center; }.joining h1 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -.06em; }.joining p { color: var(--mist); }.joining a { color: var(--cyan); text-decoration: underline; }
</style>
