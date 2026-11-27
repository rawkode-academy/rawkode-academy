<script setup lang="ts">
import { button } from "@rawkodeacademy/design-system";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatTimestamp } from "../lib/format.ts";
import type { Comment } from "../lib/queries.ts";

const props = defineProps<{
	reviewId: string;
	videoUrl: string;
	comments: Comment[];
	canComment: boolean;
	canSignOff: boolean;
	canTriage: boolean;
	signedOffBy: string | null;
	readOnly: boolean;
}>();

const video = ref<HTMLVideoElement | null>(null);
const now = ref(0);
const body = ref("");
const pin = ref(true);
const error = ref("");
const busy = ref(false);
let hls: { destroy(): void } | undefined;

const TRIAGE = [
	["new", "New"],
	["actionable", "Actionable"],
	["not_actionable", "Not actionable"],
	["fixed", "Fixed"],
] as const;

const visible = computed(() => props.comments.filter((c) => c.triage !== "withdrawn"));

onMounted(async () => {
	const el = video.value;
	if (!el) return;
	el.addEventListener("timeupdate", () => (now.value = el.currentTime * 1000));
	if (props.videoUrl.endsWith(".m3u8") && !el.canPlayType("application/vnd.apple.mpegurl")) {
		const { default: Hls } = await import("hls.js");
		if (Hls.isSupported()) {
			const player = new Hls();
			player.loadSource(props.videoUrl);
			player.attachMedia(el);
			hls = player;
		}
	} else {
		el.src = props.videoUrl;
	}
});
onBeforeUnmount(() => hls?.destroy());

const seek = (ms: number) => {
	if (!video.value) return;
	video.value.currentTime = ms / 1000;
	void video.value.play();
};

const send = async (payload: Record<string, unknown>) => {
	busy.value = true;
	error.value = "";
	try {
		const response = await fetch("/api/review", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const result = (await response.json()) as { error?: string };
		if (!response.ok) throw new Error(result.error ?? "Something went wrong");
		location.reload();
	} catch (cause) {
		error.value = cause instanceof Error ? cause.message : "Something went wrong";
		busy.value = false;
	}
};

const submit = () =>
	send({
		action: "comment",
		reviewId: props.reviewId,
		body: body.value,
		timestampMs: pin.value && video.value ? Math.round(video.value.currentTime * 1000) : null,
	});
</script>

<template>
	<div class="review">
		<div class="stage">
			<video ref="video" controls preload="metadata" playsinline></video>
			<div v-if="canSignOff" class="signoff">
				<p>Happy with this cut? Signing off tells us you have no further comments. We decide what to act on and when it goes live.</p>
				<button :class="button({ variant: 'solid' })" :disabled="busy" @click="send({ action: 'signoff', reviewId })">I'm happy with this cut</button>
			</div>
			<p v-else-if="signedOffBy" class="signoff">Signed off by {{ signedOffBy }}.</p>
		</div>
		<section class="comments" aria-labelledby="comments-title">
			<h2 id="comments-title">Comments ({{ visible.length }})</h2>
			<p v-if="visible.length === 0" class="muted">No comments yet. Anything that looks wrong is worth saying: a mistake, a rendering glitch, a cut that feels off.</p>
			<ol class="list">
				<li v-for="c in visible" :key="c.id" :class="['comment', c.authorSide]">
					<div class="head">
						<button v-if="c.timestampMs !== null" class="stamp" @click="seek(c.timestampMs)">{{ formatTimestamp(c.timestampMs) }}</button>
						<span v-else class="stamp general">General</span>
						<span class="author">{{ c.authorLogin }}<template v-if="c.authorSide === 'staff'"> · Rawkode</template></span>
						<span class="cut">Cut {{ c.draftVersion }}</span>
					</div>
					<p class="text">{{ c.body }}</p>
					<div class="foot">
						<select v-if="canTriage" :value="c.triage" :aria-label="`Triage comment by ${c.authorLogin}`" @change="send({ action: 'triage', id: c.id, triage: ($event.target as HTMLSelectElement).value })">
							<option v-for="[value, label] in TRIAGE" :key="value" :value="value">{{ label }}</option>
						</select>
						<span v-else class="triage">{{ TRIAGE.find(([v]) => v === c.triage)?.[1] ?? c.triage }}</span>
						<button v-if="!canTriage && !readOnly && c.mayWithdraw" class="link" @click="send({ action: 'triage', id: c.id, triage: 'withdrawn' })">Withdraw</button>
					</div>
				</li>
			</ol>
			<form v-if="canComment" class="new" @submit.prevent="submit">
				<label for="body">Add a comment</label>
				<textarea id="body" v-model="body" rows="3" maxlength="2000" required placeholder="What did you notice?"></textarea>
				<label class="pin"><input v-model="pin" type="checkbox" /> Pin to <strong>{{ formatTimestamp(now) }}</strong></label>
				<p v-if="error" class="error" role="alert">{{ error }}</p>
				<button :class="button({ variant: 'solid' })" :disabled="busy">Post comment</button>
			</form>
			<p v-else-if="readOnly" class="muted">Read-only while viewing as.</p>
			<p v-else class="muted">Comments are closed for this review.</p>
		</section>
	</div>
</template>

<style scoped>
.review { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1fr); font-family: var(--fonts-academy-text); color: var(--colors-academy-text); }
@media (min-width: 64rem) { .review { grid-template-columns: minmax(0, 1.6fr) minmax(20rem, 1fr); align-items: start; } }
video { width: 100%; aspect-ratio: 16 / 9; background: var(--colors-academy-ink); border-radius: var(--radii-academy-m); display: block; }
.signoff { margin-top: 1rem; padding: 1rem; border: 1px solid var(--colors-academy-border); border-radius: var(--radii-academy-m); background: var(--colors-academy-panel); display: grid; gap: 0.75rem; justify-items: start; }
.comments { border: 1px solid var(--colors-academy-border); border-radius: var(--radii-academy-m); background: var(--colors-academy-panel); padding: 1.25rem; }
h2 { font-family: var(--fonts-academy-display); font-size: 1.125rem; margin: 0 0 1rem; }
.muted { color: var(--colors-academy-text-muted); font-size: 0.9375rem; }
.list { list-style: none; margin: 0 0 1.25rem; padding: 0; display: grid; gap: 1rem; }
.comment { padding-bottom: 1rem; border-bottom: 1px solid var(--colors-academy-border); }
.comment.staff { border-left: 3px solid var(--colors-academy-accent); padding-left: 0.75rem; }
.head { display: flex; gap: 0.625rem; align-items: baseline; flex-wrap: wrap; }
.stamp { font-family: var(--fonts-academy-mono); font-size: 0.8125rem; font-weight: 600; color: var(--colors-academy-accent); background: transparent; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
.stamp.general { color: var(--colors-academy-text-muted); text-decoration: none; cursor: default; }
.author { font-weight: 700; font-size: 0.875rem; }
.cut { margin-left: auto; font-family: var(--fonts-academy-mono); font-size: 0.75rem; color: var(--colors-academy-text-muted); }
.text { margin: 0.375rem 0 0.5rem; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
.foot { display: flex; gap: 0.75rem; align-items: center; font-size: 0.8125rem; }
.triage { font-family: var(--fonts-academy-mono); color: var(--colors-academy-text-muted); }
.link { background: none; border: 0; padding: 0; color: var(--colors-academy-accent); cursor: pointer; font: inherit; text-decoration: underline; }
select, textarea { font: inherit; background: var(--colors-academy-input); color: var(--colors-academy-text); border: 1px solid var(--colors-academy-input-border); border-radius: var(--radii-academy-s); padding: 0.375rem 0.5rem; }
.new { display: grid; gap: 0.625rem; }
.new label { font-weight: 600; font-size: 0.875rem; }
.pin { font-weight: 400 !important; display: flex; gap: 0.5rem; align-items: center; }
.error { color: var(--colors-academy-status-rust); margin: 0; }
</style>
