<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps<{
	playbackUrl: string;
	title: string;
}>();

const videoElement = ref<HTMLVideoElement | null>(null);
const status = ref<"connecting" | "failed" | "idle" | "live">("idle");
const errorMessage = ref("");
let playbackSession: WhepPlaybackSession | undefined;
let playbackAbortController: AbortController | undefined;
let retryTimer: number | undefined;
let connectVersion = 0;
let isUnmounted = false;

interface WhepPlaybackSession {
	close: () => Promise<void>;
}

onMounted(() => {
	void connectPlayback();
});

watch(
	() => props.playbackUrl,
	() => {
		void connectPlayback();
	},
);

onUnmounted(() => {
	isUnmounted = true;
	clearRetryTimer();
	void cleanupPlayback();
});

async function connectPlayback(): Promise<void> {
	clearRetryTimer();
	const version = connectVersion + 1;
	connectVersion = version;
	await cleanupPlayback();
	const video = videoElement.value;
	if (!video || !props.playbackUrl) {
		return;
	}

	status.value = "connecting";
	errorMessage.value = "";
	const abortController = new AbortController();
	playbackAbortController = abortController;
	try {
		const session = await startWhepPlayback(
			props.playbackUrl,
			video,
			{
				onConnectionLost: () => {
					if (connectVersion !== version || isUnmounted) return;
					status.value = "connecting";
					schedulePlaybackRetry();
				},
				onTrack: () => {
					if (connectVersion !== version || isUnmounted) return;
					status.value = "live";
				},
			},
			abortController.signal,
		);
		if (connectVersion !== version || isUnmounted || abortController.signal.aborted) {
			await session.close();
			return;
		}
		playbackSession = session;
	} catch (error) {
		if (connectVersion !== version || isUnmounted) return;
		status.value = "failed";
		errorMessage.value = error instanceof Error
			? error.message
			: "Live playback failed.";
		schedulePlaybackRetry();
	}
}

async function cleanupPlayback(): Promise<void> {
	const abortController = playbackAbortController;
	playbackAbortController = undefined;
	abortController?.abort();
	const session = playbackSession;
	playbackSession = undefined;
	await session?.close().catch(() => undefined);
	if (videoElement.value) {
		videoElement.value.pause();
		videoElement.value.srcObject = null;
	}
}

function schedulePlaybackRetry(): void {
	clearRetryTimer();
	if (isUnmounted) return;
	retryTimer = window.setTimeout(() => {
		void connectPlayback();
	}, 5000);
}

function clearRetryTimer(): void {
	if (retryTimer === undefined) return;
	window.clearTimeout(retryTimer);
	retryTimer = undefined;
}

async function startWhepPlayback(
	playbackUrl: string,
	video: HTMLVideoElement,
	callbacks: {
		onConnectionLost: () => void;
		onTrack: () => void;
	},
	signal: AbortSignal,
): Promise<WhepPlaybackSession> {
	const peerConnection = new RTCPeerConnection();
	const remoteStream = new MediaStream();
	let resourceUrl: string | null = null;
	let deletedResourceUrl: string | null = null;
	let closed = false;
	const close = async () => {
		if (!closed) {
			closed = true;
			peerConnection.close();
		}
		if (resourceUrl && deletedResourceUrl !== resourceUrl) {
			deletedResourceUrl = resourceUrl;
			await fetch(resourceUrl, { method: "DELETE" }).catch(() => undefined);
		}
	};
	const handleAbort = () => {
		void close();
	};
	signal.addEventListener("abort", handleAbort, { once: true });
	peerConnection.addTransceiver("video", { direction: "recvonly" });
	peerConnection.addTransceiver("audio", { direction: "recvonly" });
	peerConnection.addEventListener("track", (event) => {
		remoteStream.addTrack(event.track);
		video.srcObject = remoteStream;
		void video.play().catch(() => undefined);
		callbacks.onTrack();
	});
	peerConnection.addEventListener("connectionstatechange", () => {
		if (
			peerConnection.connectionState === "failed" ||
			peerConnection.connectionState === "disconnected"
		) {
			callbacks.onConnectionLost();
		}
	});

	try {
		if (signal.aborted) {
			throw new Error("Live playback stopped.");
		}
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		await waitForIceGathering(peerConnection, signal);
		if (!peerConnection.localDescription?.sdp) {
			throw new Error("Unable to create WHEP offer.");
		}

		const response = await fetch(playbackUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/sdp",
			},
			body: peerConnection.localDescription.sdp,
			signal,
		});
		if (!response.ok) {
			throw new Error(`Live playback failed with ${response.status}.`);
		}
		resourceUrl = getWhepResourceUrl(playbackUrl, response);

		await peerConnection.setRemoteDescription({
			type: "answer",
			sdp: await response.text(),
		});
		if (signal.aborted) {
			throw new Error("Live playback stopped.");
		}
	} catch (error) {
		await close();
		throw error;
	} finally {
		signal.removeEventListener("abort", handleAbort);
	}

	return {
		close: async () => {
			await close();
		},
	};
}

function getWhepResourceUrl(playbackUrl: string, response: Response): string | null {
	const location = response.headers.get("Location");
	if (!location) return null;
	return new URL(location, playbackUrl).href;
}

async function waitForIceGathering(
	peerConnection: RTCPeerConnection,
	signal: AbortSignal,
): Promise<void> {
	if (peerConnection.iceGatheringState === "complete") {
		return;
	}

	await new Promise<void>((resolve) => {
		const timeout = window.setTimeout(finish, 5000);
		function finish() {
			window.clearTimeout(timeout);
			peerConnection.removeEventListener("icegatheringstatechange", onChange);
			signal.removeEventListener("abort", finish);
			resolve();
		}
		function onChange() {
			if (peerConnection.iceGatheringState === "complete") {
				finish();
			}
		}
		signal.addEventListener("abort", finish, { once: true });
		peerConnection.addEventListener("icegatheringstatechange", onChange);
	});
}
</script>

<template>
	<div class="live-player">
		<video
			ref="videoElement"
			autoplay
			class="live-player__video"
			controls
			muted
			playsinline
			:title="title"
		/>
		<div v-if="status !== 'live'" class="live-player__status">
			{{ status === "failed" ? errorMessage : "Connecting live stream" }}
		</div>
	</div>
</template>

<style scoped>
.live-player {
	position: relative;
	width: 100%;
	height: 100%;
	background: #05080a;
}

.live-player__video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	background: #05080a;
}

.live-player__status {
	position: absolute;
	inset: auto 16px 16px 16px;
	padding: 10px 12px;
	border-radius: 6px;
	background: rgba(5, 8, 10, 0.78);
	color: #fff;
	font-size: 14px;
	font-weight: 700;
}
</style>
