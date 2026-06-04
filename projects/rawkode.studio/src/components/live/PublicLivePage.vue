<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { LiveEvent, StudioApiResponse } from "@/core/types";

const event = ref<LiveEvent | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const statusLabel = computed(() => {
	if (!event.value) return "Loading";
	if (event.value.status === "live") return "Live now";
	if (event.value.status === "preview" || event.value.status === "ready") return "Preparing";
	if (event.value.status === "ended" || event.value.status === "imported") return "Stream ended";
	return "Scheduled";
});

const scheduledLabel = computed(() => {
	if (!event.value) return "";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(event.value.scheduledStart));
});

async function fetchEvent() {
	loading.value = true;
	error.value = null;

	try {
		const response = await fetch("/api/events/current");
		const payload = await response.json() as StudioApiResponse<LiveEvent>;
		if (!payload.ok || !payload.data) {
			throw new Error(payload.error ?? "Unable to load live event");
		}
		event.value = payload.data;
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Unable to load live event";
	} finally {
		loading.value = false;
	}
}

onMounted(fetchEvent);
</script>

<template>
	<main class="watch-shell">
		<section class="watch-main">
			<div class="watch-copy">
				<p class="watch-series">Rawkode Live</p>
				<h1>{{ event?.title ?? "Rawkode Live" }}</h1>
				<p>
					Live coding, tutorials, and cloud native production notes from the Rawkode Studio control room.
				</p>
			</div>
			<div class="watch-status" :data-status="event?.status ?? 'loading'">
				<span class="status-dot"></span>
				<span>{{ statusLabel }}</span>
				<time v-if="event" :datetime="event.scheduledStart">{{ scheduledLabel }}</time>
			</div>
		</section>

		<section class="watch-grid" aria-label="Live stream and chat">
			<div class="player-frame">
				<div v-if="loading" class="slate">
					<strong>Loading Cloudflare Stream</strong>
					<span>Fetching the current Rawkode Live event.</span>
				</div>
				<div v-else-if="error" class="slate slate-error">
					<strong>Playback unavailable</strong>
					<span>{{ error }}</span>
				</div>
				<iframe
					v-else-if="event?.playbackUrls.streamEmbed"
					:src="event.playbackUrls.streamEmbed"
					title="Rawkode Live Cloudflare Stream player"
					allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
					allowfullscreen
				></iframe>
				<div v-else class="slate">
					<strong>Rawkode Live is scheduled</strong>
					<span>Cloudflare Stream playback appears here when the operator prepares the live input.</span>
				</div>
			</div>

			<aside class="audience-panel" aria-label="Audience tools">
				<div class="panel-section">
					<h2>Chat</h2>
					<p>Waddle-backed community chat is available on rawkode.chat.</p>
					<a class="panel-action" href="https://rawkode.chat" target="_blank" rel="noreferrer">Open Chat</a>
				</div>

				<div class="panel-section">
					<h2>Destinations</h2>
					<div class="destination-list">
						<a href="https://www.youtube.com/@rawkode" target="_blank" rel="noreferrer">YouTube</a>
						<a href="https://www.twitch.tv/rawkode" target="_blank" rel="noreferrer">Twitch</a>
						<a href="https://www.linkedin.com/in/rawkode/" target="_blank" rel="noreferrer">LinkedIn</a>
					</div>
				</div>

				<div class="panel-section">
					<h2>MoQ Lab</h2>
					<p>MoQ playback stays experimental until the Cloudflare Stream lane is proven in production.</p>
				</div>
			</aside>
		</section>
	</main>
</template>

<style scoped>
.watch-shell {
	width: min(1480px, calc(100vw - 2rem));
	margin: 0 auto;
	padding: clamp(1.25rem, 3vw, 2.5rem) 0 3rem;
}

.watch-main {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 1.5rem;
	align-items: end;
	margin-bottom: 1.25rem;
}

.watch-copy {
	max-width: 54rem;
}

.watch-series {
	margin: 0 0 0.5rem;
	color: var(--studio-cyan);
	font-size: 0.82rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0;
}

h1 {
	margin: 0;
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: clamp(2.1rem, 5vw, 4.9rem);
	line-height: 0.98;
	letter-spacing: 0;
	color: var(--studio-text);
}

.watch-copy p:last-child {
	max-width: 42rem;
	margin: 1rem 0 0;
	color: var(--studio-muted);
	font-size: clamp(1rem, 1.7vw, 1.2rem);
	line-height: 1.55;
}

.watch-status {
	display: flex;
	align-items: center;
	gap: 0.55rem;
	min-height: 2.65rem;
	padding: 0.45rem 0.7rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.5rem;
	background: var(--studio-surface);
	box-shadow: var(--studio-shadow);
	color: var(--studio-muted);
	font-size: 0.86rem;
	font-weight: 700;
	white-space: nowrap;
}

.watch-status time {
	color: var(--studio-subtle);
	font-weight: 500;
}

.status-dot {
	width: 0.64rem;
	height: 0.64rem;
	border-radius: 999px;
	background: var(--studio-amber);
}

.watch-status[data-status="live"] .status-dot {
	background: var(--studio-red);
	box-shadow: 0 0 0 5px rgb(220 38 38 / 14%);
}

.watch-grid {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(20rem, 27rem);
	gap: 1rem;
	align-items: stretch;
}

.player-frame,
.audience-panel {
	border: 1px solid var(--studio-border);
	border-radius: 0.5rem;
	background: var(--studio-surface);
	box-shadow: var(--studio-shadow);
}

.player-frame {
	position: relative;
	overflow: hidden;
	aspect-ratio: 16 / 9;
	background: #020617;
}

.player-frame iframe {
	width: 100%;
	height: 100%;
	border: 0;
}

.slate {
	display: grid;
	place-content: center;
	gap: 0.5rem;
	height: 100%;
	padding: 2rem;
	text-align: center;
	color: white;
	background:
		linear-gradient(135deg, rgb(8 145 178 / 22%), transparent 50%),
		#020617;
}

.slate strong {
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: clamp(1.4rem, 3vw, 2.4rem);
}

.slate span {
	color: rgb(226 232 240 / 84%);
}

.slate-error {
	background:
		linear-gradient(135deg, rgb(220 38 38 / 24%), transparent 50%),
		#020617;
}

.audience-panel {
	display: grid;
	align-content: start;
	gap: 0;
	overflow: hidden;
}

.panel-section {
	padding: 1.1rem;
	border-bottom: 1px solid var(--studio-border);
}

.panel-section:last-child {
	border-bottom: 0;
}

.panel-section h2 {
	margin: 0 0 0.45rem;
	font-family: var(--font-display, "Sora"), ui-sans-serif, system-ui, sans-serif;
	font-size: 0.96rem;
}

.panel-section p {
	margin: 0;
	color: var(--studio-muted);
	font-size: 0.9rem;
	line-height: 1.45;
}

.panel-action,
.destination-list a {
	display: inline-flex;
	align-items: center;
	min-height: 2.15rem;
	margin-top: 0.8rem;
	padding: 0 0.7rem;
	border: 1px solid var(--studio-border);
	border-radius: 0.45rem;
	background: var(--studio-surface-soft);
	color: var(--studio-text);
	font-size: 0.84rem;
	font-weight: 700;
}

.destination-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.45rem;
}

@media (max-width: 980px) {
	.watch-main,
	.watch-grid {
		grid-template-columns: 1fr;
	}

	.watch-status {
		justify-self: start;
	}
}
</style>
