<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import LiveGameRoom from "@/components/LiveGameRoom.vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import {
	consumeBootstrap,
	joinBootstrapKey,
	requestJoin,
	type ArcadeRole,
	type RoomBootstrap,
} from "@/lib/room-bootstrap";

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
	<LiveGameRoom
		v-if="bootstrap"
		:room-id="bootstrap.roomId"
		:room-code="code"
		:game="gameById(game).id"
		:ticket="bootstrap.wsTicket"
		:socket-url="bootstrap.socketUrl"
		:view-role="bootstrap.role"
		:role="role === 'contestant' ? 'contestant' : role"
	/>
	<section v-else class="joining" :aria-busy="!error" aria-live="polite">
		<h1>{{ error || "Joining the live room…" }}</h1>
		<p v-if="error">Return to <a href="/join">join</a> and try again.</p>
	</section>
</template>
<style scoped>
.joining { align-items: center; display: grid; justify-content: center; min-height: 70vh; padding: 2rem; text-align: center; }.joining h1 { font-family: "Space Grotesk", sans-serif; font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -.06em; }.joining p { color: var(--mist); }.joining a { color: var(--cyan); text-decoration: underline; }
</style>
