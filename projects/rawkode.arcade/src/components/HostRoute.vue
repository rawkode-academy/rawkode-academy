<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import HostControlDeck from "@/components/HostControlDeck.vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import {
	consumeBootstrap,
	hostBootstrapKey,
	requestExistingRoom,
	requestJoin,
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

const props = withDefaults(
	defineProps<{ roomId: string; game?: GameId; code?: string }>(),
	{ game: "merge-conflict" },
);
const bootstrap = ref<RoomBootstrap>();
const error = ref("");
const roomGame = ref<GameId>(props.game);
const signInHref = computed(() => {
	const path = `/host/${encodeURIComponent(props.roomId)}`;
	const returnTo = props.code ? `${path}?code=${encodeURIComponent(props.code)}` : path;
	return `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
});

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
	<section v-else :class="[shell, joining]" :aria-busy="!error" aria-live="polite">
		<span :class="slug({ tone: error ? 'closed' : 'live' })">
			{{ error ? "Not authorised" : "Opening" }}
		</span>
		<h1 :class="text({ style: 'headline' })">
			{{ error || "Opening producer controls" }}
		</h1>
		<a v-if="error" :class="control({ tone: 'quiet' })" href="/">Back to formats</a>
		<a v-if="error" :class="control({ tone: 'live' })" :href="signInHref">Sign in with Academy</a>
	</section>
</template>
