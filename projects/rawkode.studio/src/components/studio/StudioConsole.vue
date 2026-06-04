<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type {
	DestinationPlatform,
	LiveEvent,
	ScenePreset,
	StudioApiResponse,
} from "@/core/types";

const props = defineProps<{
	operatorName: string;
}>();

const event = ref<LiveEvent | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const statusMessage = ref("Studio idle");
const selectedSceneId = ref("screen-share");
const guestName = ref("");
const trackRecordingEnabled = ref(true);
const recordingUrl = ref<string | null>(null);

const programCanvas = ref<HTMLCanvasElement | null>(null);
const hostVideo = ref<HTMLVideoElement | null>(null);
const screenVideo = ref<HTMLVideoElement | null>(null);

const cameraStream = ref<MediaStream | null>(null);
const screenStream = ref<MediaStream | null>(null);
const programStream = ref<MediaStream | null>(null);

let renderFrame = 0;
let audioContext: AudioContext | null = null;
let audioDestination: MediaStreamAudioDestinationNode | null = null;
let peerConnection: RTCPeerConnection | null = null;
let whipSessionUrl: string | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];

const selectedScene = computed<ScenePreset | null>(() => {
	return event.value?.scenePresets.find((scene) => scene.id === selectedSceneId.value) ?? null;
});

const isLive = computed(() => event.value?.status === "live");
const hasCamera = computed(() => Boolean(cameraStream.value));
const hasScreen = computed(() => Boolean(screenStream.value));
const hasWhip = computed(() => Boolean(event.value?.playbackUrls.whip));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
	const payload = await response.json() as StudioApiResponse<T>;
	if (!payload.ok || !payload.data) {
		throw new Error(payload.error ?? "Studio API request failed");
	}
	return payload.data;
}

async function refreshEvent() {
	loading.value = true;
	error.value = null;

	try {
		event.value = await api<LiveEvent>("/api/events/current");
		selectedSceneId.value = event.value.scenePresets[1]?.id ?? event.value.scenePresets[0]?.id ?? "solo";
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Unable to load studio event";
	} finally {
		loading.value = false;
	}
}

async function updateEventFromAction(path: string, init?: RequestInit) {
	if (!event.value) return;
	event.value = await api<LiveEvent>(`/api/events/${event.value.id}/${path}`, {
		method: "POST",
		...init,
	});
}

async function prepareInput() {
	await updateEventFromAction("prepare");
	statusMessage.value = event.value?.playbackUrls.whip
		? "Cloudflare Stream WHIP endpoint ready"
		: "Cloudflare Stream fallback credentials ready";
}

async function startPreview() {
	startRenderer();
	programStream.value = buildProgramStream();
	await updateEventFromAction("preview");
	statusMessage.value = "Program preview is rendering locally";
}

async function getCamera() {
	const stream = await navigator.mediaDevices.getUserMedia({
		video: {
			width: { ideal: 1280 },
			height: { ideal: 720 },
			frameRate: { ideal: 30 },
		},
		audio: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
		},
	});

	cameraStream.value = stream;
	await nextTick();
	if (hostVideo.value) {
		hostVideo.value.srcObject = stream;
		await hostVideo.value.play().catch(() => {});
	}
	statusMessage.value = "Camera and microphone source connected";
}

async function shareScreen() {
	const stream = await navigator.mediaDevices.getDisplayMedia({
		video: {
			frameRate: { ideal: 30 },
		},
		audio: true,
	});

	screenStream.value = stream;
	await nextTick();
	if (screenVideo.value) {
		screenVideo.value.srcObject = stream;
		await screenVideo.value.play().catch(() => {});
	}
	statusMessage.value = "Screen source connected";
}

async function inviteGuest() {
	const displayName = guestName.value.trim();
	if (!displayName || !event.value) return;

	event.value = await api<LiveEvent>(`/api/events/${event.value.id}/invite-guest`, {
		method: "POST",
		body: JSON.stringify({ displayName }),
	});
	guestName.value = "";
	statusMessage.value = `${displayName} added to the green room`;
}

async function toggleDestination(platform: DestinationPlatform, enabled: boolean) {
	if (!event.value) return;

	event.value = await api<LiveEvent>(`/api/events/${event.value.id}/destinations/${platform}`, {
		method: "PUT",
		body: JSON.stringify({ enabled }),
	});

	const destination = event.value.destinations.find((item) => item.platform === platform);
	statusMessage.value = `${destination?.label ?? platform} ${enabled ? "enabled" : "disabled"}`;
}

function checkboxValue(event: Event): boolean {
	return (event.currentTarget as HTMLInputElement).checked;
}

function startRenderer() {
	const canvas = programCanvas.value;
	if (!canvas) return;

	canvas.width = 1920;
	canvas.height = 1080;

	if (renderFrame) return;

	const render = () => {
		drawProgram(canvas);
		renderFrame = requestAnimationFrame(render);
	};

	render();
}

function stopRenderer() {
	if (renderFrame) {
		cancelAnimationFrame(renderFrame);
		renderFrame = 0;
	}
}

function buildProgramStream(): MediaStream {
	const canvas = programCanvas.value;
	if (!canvas) {
		throw new Error("Program canvas is not available");
	}

	startRenderer();
	const canvasStream = canvas.captureStream(30);
	const audioTracks = mixAudioTracks();
	return new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
}

function mixAudioTracks(): MediaStreamTrack[] {
	const streams = [cameraStream.value, screenStream.value].filter((stream): stream is MediaStream => {
		return Boolean(stream?.getAudioTracks().length);
	});

	if (streams.length === 0) return [];

	audioContext?.close().catch(() => {});
	audioContext = new AudioContext();
	audioDestination = audioContext.createMediaStreamDestination();

	for (const stream of streams) {
		const source = audioContext.createMediaStreamSource(stream);
		source.connect(audioDestination);
	}

	return audioDestination.stream.getAudioTracks();
}

function drawProgram(canvas: HTMLCanvasElement) {
	const context = canvas.getContext("2d");
	if (!context) return;

	context.fillStyle = "#020617";
	context.fillRect(0, 0, canvas.width, canvas.height);
	drawGrid(context, canvas.width, canvas.height);

	const scene = selectedScene.value?.layout ?? "screen-share";
	if (scene === "solo") {
		drawVideoOrSlate(context, hostVideo.value, 0, 0, 1920, 1080, "Camera");
	} else if (scene === "guest-pair") {
		drawVideoOrSlate(context, hostVideo.value, 64, 120, 888, 640, "Camera");
		drawMockGuest(context, 968, 120, 888, 640);
	} else if (scene === "panel") {
		drawVideoOrSlate(context, hostVideo.value, 64, 90, 888, 430, "Camera");
		drawMockGuest(context, 968, 90, 888, 430);
		drawVideoOrSlate(context, screenVideo.value, 64, 548, 888, 392, "Screen");
		drawSlate(context, 968, 548, 888, 392, "Guest two");
	} else if (scene === "break") {
		drawBreakSlate(context);
	} else {
		drawVideoOrSlate(context, screenVideo.value, 0, 0, 1920, 1080, "Screen");
		drawPip(context, hostVideo.value);
	}

	drawLowerThird(context);
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
	context.save();
	context.strokeStyle = "rgba(148, 163, 184, 0.08)";
	context.lineWidth = 1;
	for (let x = 0; x < width; x += 96) {
		context.beginPath();
		context.moveTo(x, 0);
		context.lineTo(x, height);
		context.stroke();
	}
	for (let y = 0; y < height; y += 96) {
		context.beginPath();
		context.moveTo(0, y);
		context.lineTo(width, y);
		context.stroke();
	}
	context.restore();
}

function drawVideoOrSlate(
	context: CanvasRenderingContext2D,
	video: HTMLVideoElement | null,
	x: number,
	y: number,
	width: number,
	height: number,
	label: string,
) {
	if (video && video.readyState >= 2) {
		context.drawImage(video, x, y, width, height);
		drawFrame(context, x, y, width, height, label);
		return;
	}
	drawSlate(context, x, y, width, height, label);
}

function drawPip(context: CanvasRenderingContext2D, video: HTMLVideoElement | null) {
	const width = 438;
	const height = 246;
	const x = 1920 - width - 58;
	const y = 1080 - height - 56;
	drawVideoOrSlate(context, video, x, y, width, height, "Camera");
}

function drawSlate(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	label: string,
) {
	context.save();
	context.fillStyle = "#111827";
	context.fillRect(x, y, width, height);
	context.fillStyle = "#1f2937";
	context.fillRect(x + 2, y + 2, width - 4, height - 4);
	context.fillStyle = "#e2e8f0";
	context.font = "600 38px IBM Plex Sans, sans-serif";
	context.textAlign = "center";
	context.fillText(label, x + width / 2, y + height / 2);
	drawFrame(context, x, y, width, height, label);
	context.restore();
}

function drawMockGuest(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
	context.save();
	const gradient = context.createLinearGradient(x, y, x + width, y + height);
	gradient.addColorStop(0, "#0e7490");
	gradient.addColorStop(1, "#14532d");
	context.fillStyle = gradient;
	context.fillRect(x, y, width, height);
	context.fillStyle = "rgba(255,255,255,0.12)";
	context.beginPath();
	context.arc(x + width / 2, y + height / 2 - 18, Math.min(width, height) * 0.18, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = "#ffffff";
	context.font = "700 44px Sora, sans-serif";
	context.textAlign = "center";
	context.fillText("Guest", x + width / 2, y + height / 2 + 110);
	drawFrame(context, x, y, width, height, "Guest");
	context.restore();
}

function drawBreakSlate(context: CanvasRenderingContext2D) {
	context.save();
	context.fillStyle = "#020617";
	context.fillRect(0, 0, 1920, 1080);
	context.fillStyle = "#ffffff";
	context.font = "700 88px Sora, sans-serif";
	context.textAlign = "center";
	context.fillText("Rawkode Live", 960, 492);
	context.fillStyle = "#94a3b8";
	context.font = "500 40px IBM Plex Sans, sans-serif";
	context.fillText("Stream starting soon", 960, 560);
	context.restore();
}

function drawFrame(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	label: string,
) {
	context.save();
	context.strokeStyle = "rgba(255,255,255,0.26)";
	context.lineWidth = 4;
	context.strokeRect(x, y, width, height);
	context.fillStyle = "rgba(2, 6, 23, 0.72)";
	context.fillRect(x + 20, y + 20, 188, 54);
	context.fillStyle = "#ffffff";
	context.font = "600 24px IBM Plex Sans, sans-serif";
	context.textAlign = "left";
	context.fillText(label, x + 42, y + 56);
	context.restore();
}

function drawLowerThird(context: CanvasRenderingContext2D) {
	context.save();
	context.fillStyle = "rgba(2, 6, 23, 0.82)";
	context.fillRect(54, 910, 740, 90);
	context.fillStyle = "#22d3ee";
	context.fillRect(54, 910, 8, 90);
	context.fillStyle = "#ffffff";
	context.font = "700 32px Sora, sans-serif";
	context.fillText(event.value?.title ?? "Rawkode Live", 88, 952);
	context.fillStyle = "#cbd5e1";
	context.font = "500 23px IBM Plex Sans, sans-serif";
	context.fillText("Cloudflare Stream | YouTube | Twitch | LinkedIn", 88, 982);
	context.restore();
}

async function waitForIceGathering(connection: RTCPeerConnection) {
	if (connection.iceGatheringState === "complete") return;

	await new Promise<void>((resolve) => {
		const timeout = setTimeout(resolve, 5000);
		connection.addEventListener("icegatheringstatechange", () => {
			if (connection.iceGatheringState === "complete") {
				clearTimeout(timeout);
				resolve();
			}
		});
	});
}

async function publishWithWhip() {
	if (!event.value?.playbackUrls.whip) {
		statusMessage.value = "No WHIP endpoint available; use RTMPS/SRT fallback";
		return;
	}

	if (!programStream.value) {
		programStream.value = buildProgramStream();
	}

	peerConnection?.close();
	peerConnection = new RTCPeerConnection();
	for (const track of programStream.value.getTracks()) {
		peerConnection.addTrack(track, programStream.value);
	}

	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	await waitForIceGathering(peerConnection);

	const response = await fetch(event.value.playbackUrls.whip, {
		method: "POST",
		headers: {
			"Content-Type": "application/sdp",
		},
		body: peerConnection.localDescription?.sdp,
	});

	if (!response.ok) {
		throw new Error(`WHIP publish failed with ${response.status}`);
	}

	const answer = await response.text();
	await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
	whipSessionUrl = response.headers.get("Location");
	statusMessage.value = "Program feed is publishing over WHIP";
}

async function goLive() {
	if (!event.value) return;
	if (!programStream.value) {
		programStream.value = buildProgramStream();
	}

	if (hasWhip.value) {
		await publishWithWhip();
	}

	await updateEventFromAction("go-live");
	if (trackRecordingEnabled.value) {
		startProgramRecording();
	}
	statusMessage.value = "Rawkode Live is live";
}

async function endLive() {
	if (!event.value) return;

	if (whipSessionUrl) {
		await fetch(whipSessionUrl, { method: "DELETE" }).catch(() => {});
	}
	peerConnection?.close();
	peerConnection = null;
	whipSessionUrl = null;
	stopProgramRecording();
	await updateEventFromAction("end");
	statusMessage.value = "Live event ended; recording is processing";
}

function startProgramRecording() {
	if (!programStream.value || mediaRecorder?.state === "recording") return;
	if (!("MediaRecorder" in window)) {
		statusMessage.value = "MediaRecorder is not available in this browser";
		return;
	}

	recordedChunks = [];
	mediaRecorder = new MediaRecorder(programStream.value, {
		mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
			? "video/webm;codecs=vp9,opus"
			: "video/webm",
	});
	mediaRecorder.addEventListener("dataavailable", (event) => {
		if (event.data.size > 0) recordedChunks.push(event.data);
	});
	mediaRecorder.addEventListener("stop", () => {
		const blob = new Blob(recordedChunks, { type: "video/webm" });
		if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
		recordingUrl.value = URL.createObjectURL(blob);
	});
	mediaRecorder.start(4000);
}

function stopProgramRecording() {
	if (mediaRecorder?.state === "recording") {
		mediaRecorder.stop();
	}
}

onMounted(refreshEvent);

onBeforeUnmount(() => {
	stopRenderer();
	peerConnection?.close();
	mediaRecorder?.state === "recording" && mediaRecorder.stop();
	cameraStream.value?.getTracks().forEach((track) => track.stop());
	screenStream.value?.getTracks().forEach((track) => track.stop());
	programStream.value?.getTracks().forEach((track) => track.stop());
	audioContext?.close().catch(() => {});
	if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
});
</script>

<template>
	<main class="console-shell">
		<section class="console-header">
			<div>
				<p>Rawkode Live</p>
				<h1>{{ event?.title ?? "Operator Studio" }}</h1>
			</div>
			<div class="operator-block">
				<span>{{ operatorName }}</span>
				<strong :data-status="event?.status ?? 'loading'">{{ event?.status ?? "loading" }}</strong>
			</div>
		</section>

		<div v-if="loading" class="loading-state">Loading studio state...</div>
		<div v-else-if="error" class="loading-state error-state">{{ error }}</div>

		<section v-else-if="event" class="console-grid">
			<aside class="left-rail">
				<div class="rail-section">
					<h2>Scenes</h2>
					<button
						v-for="scene in event.scenePresets"
						:key="scene.id"
						class="scene-button"
						:class="{ active: selectedSceneId === scene.id }"
						type="button"
						@click="selectedSceneId = scene.id"
					>
						<span>{{ scene.name }}</span>
						<small>{{ scene.layout }}</small>
					</button>
				</div>

				<div class="rail-section">
					<h2>Guests</h2>
					<form class="guest-form" @submit.prevent="inviteGuest">
						<input v-model="guestName" placeholder="Guest name" />
						<button type="submit">Invite</button>
					</form>
					<div class="guest-list">
						<div v-for="participant in event.participants" :key="participant.id" class="guest-row">
							<span>{{ participant.displayName }}</span>
							<small>{{ participant.connectionState }}</small>
						</div>
					</div>
				</div>
			</aside>

			<section class="program-column">
				<div class="program-toolbar">
					<div>
						<strong>Program</strong>
						<span>{{ selectedScene?.name ?? "Scene" }}</span>
					</div>
					<div class="status-line">{{ statusMessage }}</div>
				</div>
				<div class="program-frame">
					<canvas ref="programCanvas" aria-label="Program composition canvas"></canvas>
					<video ref="hostVideo" muted playsinline class="hidden-source"></video>
					<video ref="screenVideo" muted playsinline class="hidden-source"></video>
				</div>

				<div class="source-strip">
					<button type="button" :class="{ active: hasCamera }" @click="getCamera">
						<span>Camera</span>
						<small>{{ hasCamera ? "connected" : "add source" }}</small>
					</button>
					<button type="button" :class="{ active: hasScreen }" @click="shareScreen">
						<span>Screen</span>
						<small>{{ hasScreen ? "connected" : "share display" }}</small>
					</button>
					<button type="button" @click="startRenderer">
						<span>Canvas</span>
						<small>render program</small>
					</button>
					<label class="recording-toggle">
						<input v-model="trackRecordingEnabled" type="checkbox" />
						<span>Record program plus tracks</span>
					</label>
				</div>
			</section>

			<aside class="right-rail">
				<div class="rail-section action-stack">
					<h2>Cloudflare Stream</h2>
					<button type="button" @click="prepareInput">Prepare live input</button>
					<button type="button" @click="startPreview">Start preview</button>
					<button type="button" class="go-live" :disabled="isLive" @click="goLive">Go Live</button>
					<button type="button" class="end-live" :disabled="!isLive" @click="endLive">End Live</button>
					<a v-if="recordingUrl" :href="recordingUrl" download="rawkode-live-program.webm">Download local program recording</a>
				</div>

				<div class="rail-section">
					<h2>Destinations</h2>
					<div v-for="destination in event.destinations" :key="destination.platform" class="destination-row">
						<div>
							<strong>{{ destination.label }}</strong>
							<small>{{ destination.health }}<template v-if="destination.lastError"> - {{ destination.lastError }}</template></small>
						</div>
						<label class="switch">
							<input
								type="checkbox"
								:checked="destination.enabled"
								@change="toggleDestination(destination.platform, checkboxValue($event))"
							/>
							<span></span>
						</label>
					</div>
				</div>

				<div class="rail-section endpoints">
					<h2>Fallback</h2>
					<p>RTMPS/SRT can be used from OBS if browser WHIP publishing fails.</p>
					<code>{{ event.playbackUrls.rtmps ?? "Prepare input for RTMPS fallback" }}</code>
				</div>

				<div class="rail-section endpoints">
					<h2>MoQ Lab</h2>
					<p>Experimental playback remains disabled until the Stream-first workflow passes staging smoke.</p>
					<code>{{ event.playbackUrls.moq ?? "Not enabled" }}</code>
				</div>
			</aside>
		</section>
	</main>
</template>

<style scoped>
.console-shell {
	width: min(1720px, calc(100vw - 1.5rem));
	margin: 0 auto;
	padding: 1rem 0 2rem;
}

.console-header {
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: 1rem;
	margin: 0 0 1rem;
}

.console-header p {
	margin: 0 0 0.32rem;
	color: var(--studio-cyan);
	font-size: 0.78rem;
	font-weight: 800;
	text-transform: uppercase;
}

.console-header h1 {
	margin: 0;
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: clamp(1.7rem, 3vw, 3rem);
	line-height: 1;
}

.operator-block {
	display: flex;
	align-items: center;
	gap: 0.65rem;
	padding: 0.55rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.5rem;
	background: var(--studio-surface);
	font-size: 0.85rem;
}

.operator-block strong {
	padding: 0.35rem 0.5rem;
	border-radius: 0.4rem;
	background: var(--studio-surface-soft);
	color: var(--studio-muted);
	text-transform: uppercase;
}

.operator-block strong[data-status="live"] {
	background: rgb(220 38 38 / 12%);
	color: var(--studio-red);
}

.console-grid {
	display: grid;
	grid-template-columns: 17rem minmax(0, 1fr) 22rem;
	gap: 0.85rem;
	align-items: start;
}

.left-rail,
.right-rail,
.program-column {
	min-width: 0;
}

.rail-section,
.program-toolbar,
.source-strip {
	border: 1px solid var(--studio-border);
	border-radius: 0.5rem;
	background: var(--studio-surface);
	box-shadow: 0 10px 38px rgb(15 23 42 / 7%);
}

.rail-section {
	margin-bottom: 0.85rem;
	padding: 0.85rem;
}

.rail-section h2 {
	margin: 0 0 0.65rem;
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: 0.86rem;
}

.scene-button,
.action-stack button,
.source-strip button {
	width: 100%;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: var(--studio-surface-soft);
	color: var(--studio-text);
	cursor: pointer;
}

.scene-button {
	display: grid;
	gap: 0.15rem;
	margin-bottom: 0.45rem;
	padding: 0.65rem;
	text-align: left;
}

.scene-button.active {
	border-color: rgb(8 145 178 / 55%);
	background: rgb(8 145 178 / 9%);
}

.scene-button span,
.source-strip span,
.destination-row strong {
	font-size: 0.85rem;
	font-weight: 800;
}

.scene-button small,
.source-strip small,
.destination-row small,
.guest-row small {
	color: var(--studio-muted);
	font-size: 0.72rem;
}

.guest-form {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 0.45rem;
}

.guest-form input {
	min-width: 0;
	height: 2.2rem;
	padding: 0 0.6rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: white;
}

.guest-form button,
.action-stack button,
.source-strip button {
	min-height: 2.2rem;
	padding: 0 0.7rem;
	font-weight: 800;
}

.guest-list {
	display: grid;
	gap: 0.45rem;
	margin-top: 0.7rem;
}

.guest-row,
.destination-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.7rem;
}

.guest-row {
	padding: 0.55rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: var(--studio-surface-soft);
}

.program-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	min-height: 3.15rem;
	margin-bottom: 0.65rem;
	padding: 0.65rem 0.85rem;
}

.program-toolbar strong,
.program-toolbar span {
	display: block;
}

.program-toolbar strong {
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: 0.9rem;
}

.program-toolbar span,
.status-line {
	color: var(--studio-muted);
	font-size: 0.78rem;
	font-weight: 600;
}

.program-frame {
	position: relative;
	overflow: hidden;
	aspect-ratio: 16 / 9;
	border: 1px solid #020617;
	border-radius: 0.5rem;
	background: #020617;
	box-shadow: var(--studio-shadow);
}

.program-frame canvas {
	display: block;
	width: 100%;
	height: 100%;
}

.hidden-source {
	position: absolute;
	width: 1px;
	height: 1px;
	opacity: 0;
	pointer-events: none;
}

.source-strip {
	display: grid;
	grid-template-columns: repeat(3, minmax(8rem, 1fr)) minmax(13rem, auto);
	gap: 0.55rem;
	margin-top: 0.65rem;
	padding: 0.65rem;
}

.source-strip button {
	display: grid;
	gap: 0.15rem;
	text-align: left;
}

.source-strip button.active {
	border-color: rgb(22 163 74 / 50%);
	background: rgb(22 163 74 / 9%);
}

.recording-toggle {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	min-height: 2.6rem;
	padding: 0 0.75rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: var(--studio-surface-soft);
	color: var(--studio-text);
	font-size: 0.78rem;
	font-weight: 800;
}

.action-stack {
	display: grid;
	gap: 0.5rem;
}

.action-stack h2 {
	margin-bottom: 0.2rem;
}

.action-stack button {
	text-align: center;
}

.action-stack .go-live {
	border-color: rgb(220 38 38 / 42%);
	background: var(--studio-red);
	color: white;
}

.action-stack .end-live {
	border-color: rgb(15 23 42 / 18%);
	background: var(--studio-bg-deep);
	color: white;
}

.action-stack button:disabled {
	cursor: not-allowed;
	opacity: 0.45;
}

.action-stack a {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 2.15rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: var(--studio-surface-soft);
	font-size: 0.78rem;
	font-weight: 800;
}

.destination-row {
	padding: 0.65rem 0;
	border-bottom: 1px solid var(--studio-border);
}

.destination-row:last-child {
	border-bottom: 0;
}

.destination-row div {
	display: grid;
	gap: 0.15rem;
	min-width: 0;
}

.switch {
	position: relative;
	display: inline-flex;
	width: 2.55rem;
	height: 1.45rem;
	flex: 0 0 auto;
}

.switch input {
	position: absolute;
	opacity: 0;
}

.switch span {
	position: absolute;
	inset: 0;
	border-radius: 999px;
	background: #cbd5e1;
	cursor: pointer;
}

.switch span::before {
	position: absolute;
	top: 0.18rem;
	left: 0.18rem;
	width: 1.09rem;
	height: 1.09rem;
	border-radius: 999px;
	background: white;
	content: "";
	transition: transform 160ms ease;
}

.switch input:checked + span {
	background: var(--studio-green);
}

.switch input:checked + span::before {
	transform: translateX(1.1rem);
}

.endpoints p {
	margin: 0 0 0.55rem;
	color: var(--studio-muted);
	font-size: 0.82rem;
	line-height: 1.4;
}

.endpoints code {
	display: block;
	max-width: 100%;
	overflow: hidden;
	padding: 0.55rem;
	border-radius: 0.4rem;
	background: #0f172a;
	color: #bae6fd;
	font-family: var(--font-mono, "Monaspace Neon"), ui-monospace, monospace;
	font-size: 0.72rem;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.loading-state {
	display: grid;
	place-items: center;
	min-height: 24rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.5rem;
	background: var(--studio-surface);
	color: var(--studio-muted);
	font-weight: 800;
}

.error-state {
	color: var(--studio-red);
}

@media (max-width: 1260px) {
	.console-grid {
		grid-template-columns: 14rem minmax(0, 1fr);
	}

	.right-rail {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.right-rail .rail-section {
		margin-bottom: 0;
	}
}

@media (max-width: 860px) {
	.console-header,
	.program-toolbar {
		align-items: flex-start;
		flex-direction: column;
	}

	.console-grid,
	.right-rail,
	.source-strip {
		grid-template-columns: 1fr;
	}
}
</style>
