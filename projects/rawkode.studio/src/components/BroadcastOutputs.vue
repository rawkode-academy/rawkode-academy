<script setup lang="ts">
import { onMounted, ref } from "vue";
import type {
	StreamOutputDestination,
	StreamOutputIngestCredentials,
	StreamOutputState,
} from "../server/stream-outputs";

const props = defineProps<{ producerUrl: string; sessionId: string }>();
const state = ref<StreamOutputState | null>(null);
const credentials = ref<StreamOutputIngestCredentials | null>(null);
const error = ref("");
const busy = ref(false);
const outputUrl = ref("");
const streamKey = ref("");

async function api(body?: Record<string, unknown>): Promise<any> {
	const response = body
		? await fetch("/api/studio/outputs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...body, sessionId: props.sessionId }),
		})
		: await fetch(`/api/studio/outputs?sessionId=${encodeURIComponent(props.sessionId)}`);
	const payload = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(payload.error || `Output request failed (${response.status}).`);
	return payload;
}

async function load() {
	error.value = "";
	try {
		state.value = await api();
	} catch (cause) {
		error.value = cause instanceof Error ? cause.message : "Output readiness could not be loaded.";
	}
}

async function run(operation: () => Promise<void>) {
	busy.value = true;
	error.value = "";
	try {
		await operation();
	} catch (cause) {
		error.value = cause instanceof Error ? cause.message : "Output operation failed.";
	} finally {
		busy.value = false;
	}
}

async function provision() {
	await run(async () => {
		const result = await api({ action: "provision" });
		credentials.value = result.credentials;
		state.value = result.state;
	});
}

async function revealCredentials() {
	await run(async () => {
		credentials.value = (await api({ action: "credentials" })).credentials;
	});
}

async function createDestination() {
	await run(async () => {
		await api({ action: "create", streamKey: streamKey.value, url: outputUrl.value });
		streamKey.value = "";
		outputUrl.value = "";
		await load();
	});
}

async function setEnabled(destination: StreamOutputDestination, enabled: boolean) {
	await run(async () => {
		await api({ action: "set-enabled", enabled, outputId: destination.uid });
		await load();
	});
}

async function remove(destination: StreamOutputDestination) {
	if (!window.confirm(`Delete output ${destination.url}?`)) return;
	await run(async () => {
		await api({ action: "delete", outputId: destination.uid });
		await load();
	});
}

async function copy(value: string) {
	await navigator.clipboard.writeText(value);
}

onMounted(load);
</script>

<template>
	<section class="outputs" aria-labelledby="broadcast-outputs-heading">
		<div class="outputs-header">
			<div>
				<p class="eyebrow">External encoder path</p>
				<h1 id="broadcast-outputs-heading">Broadcast destinations</h1>
			</div>
			<a class="button" :href="producerUrl">Open producer room</a>
		</div>

		<p class="truth">
			The browser programme uses Cloudflare WHIP. Cloudflare cannot restream that WHIP input.
			Managed destinations use a separate RTMPS/SRT input and only receive video while OBS or
			another encoder captures the programme monitor and publishes to it.
		</p>
		<p v-if="error" class="form-error" role="alert">{{ error }}</p>
		<p v-if="!state && !error" class="muted">Loading output readiness…</p>

		<template v-if="state">
			<div class="readiness">
				<div v-for="requirement in state.readiness.requirements" :key="requirement.id" class="requirement">
					<span :class="requirement.ready ? 'ready' : 'blocked'">
						{{ requirement.ready ? "Ready" : "Required" }}
					</span>
					<p>{{ requirement.message }}</p>
				</div>
			</div>

			<div v-if="state.readiness.outputInputState === 'not-provisioned'" class="action-panel">
				<h2>Provision the encoder input</h2>
				<p>
					This creates a separate Cloudflare live input. It does not connect the browser programme
					automatically and it does not start a broadcast.
				</p>
				<button class="button primary" type="button" :disabled="busy" @click="provision">
					Provision RTMPS/SRT input
				</button>
			</div>
			<div v-else-if="state.readiness.outputInputState === 'uncertain'" class="action-panel">
				<h2>Operator reconciliation required</h2>
				<p>
					Cloudflare may have created an input without returning a complete response. Studio will
					not retry automatically because that could create an unmanaged duplicate.
				</p>
			</div>
			<div v-else-if="state.readiness.outputInputState === 'provisioning'" class="action-panel">
				<h2>Provisioning in progress</h2>
				<p>Reload after the current provisioning request completes.</p>
			</div>

			<div v-if="state.readiness.outputInputState === 'ready'" class="action-panel">
				<h2>Encoder ingest</h2>
				<p>Credentials are fetched only on request and are never saved by Studio.</p>
				<button class="button" type="button" :disabled="busy" @click="revealCredentials">
					Reveal ingest credentials
				</button>
			</div>

			<div v-if="credentials" class="credentials" aria-label="Encoder ingest credentials">
				<div>
					<strong>RTMPS server</strong><code>{{ credentials.rtmps.url }}</code>
					<button class="button" type="button" @click="copy(credentials.rtmps.url)">Copy</button>
				</div>
				<div>
					<strong>RTMPS key</strong><code>••••••••••••</code>
					<button class="button" type="button" @click="copy(credentials.rtmps.streamKey)">Copy secret</button>
				</div>
				<div>
					<strong>SRT server</strong><code>{{ credentials.srt.url }}</code>
					<button class="button" type="button" @click="copy(credentials.srt.url)">Copy</button>
				</div>
				<div>
					<strong>SRT stream ID</strong><code>{{ credentials.srt.streamId }}</code>
					<button class="button" type="button" @click="copy(credentials.srt.streamId)">Copy</button>
				</div>
				<div>
					<strong>SRT passphrase</strong><code>••••••••••••</code>
					<button class="button" type="button" @click="copy(credentials.srt.passphrase)">Copy secret</button>
				</div>
				<button class="button" type="button" @click="credentials = null">Hide credentials</button>
			</div>

			<div v-if="state.readiness.managedOutputsReady" class="destination-panel">
				<div>
					<h2>Destinations</h2>
					<p>New destinations start disabled. Enable one only when the encoder feed is verified.</p>
				</div>
				<form class="destination-form" @submit.prevent="createDestination">
					<label>RTMP/RTMPS destination URL<input v-model="outputUrl" required type="url" placeholder="rtmps://…" /></label>
					<label>Stream key<input v-model="streamKey" required type="password" autocomplete="off" /></label>
					<button class="button primary" type="submit" :disabled="busy">Add disabled destination</button>
				</form>
				<div v-if="state.destinations.length" class="destination-list">
					<article v-for="destination in state.destinations" :key="destination.uid">
						<div><strong>{{ destination.url }}</strong><span>{{ destination.enabled ? "Enabled" : "Disabled" }}</span></div>
						<div class="actions">
							<button class="button" type="button" :disabled="busy" @click="setEnabled(destination, !destination.enabled)">
								{{ destination.enabled ? "Disable" : "Enable" }}
							</button>
							<button class="button danger" type="button" :disabled="busy" @click="remove(destination)">Delete</button>
						</div>
					</article>
				</div>
				<p v-else class="muted">No managed destinations are configured.</p>
			</div>

			<details class="limitations">
				<summary>Why the WHIP input cannot be used</summary>
				<ul><li v-for="limitation in state.readiness.whipLimitations" :key="limitation">{{ limitation }}</li></ul>
			</details>
		</template>
	</section>
</template>

<style scoped>
.outputs { display: grid; gap: 16px; width: min(960px, calc(100vw - 32px)); margin: 32px auto 48px; }
.outputs-header, .requirement, .destination-list article, .actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h1, h2, p { margin: 0; } h1 { color: #fff; font-size: 32px; } h2 { color: #fff; font-size: 19px; }
.truth, .action-panel, .credentials, .destination-panel, .limitations { padding: 18px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(10,13,18,.82); color: #b8c7cf; line-height: 1.55; }
.readiness { display: grid; gap: 8px; } .requirement { justify-content: flex-start; padding: 11px 14px; border-radius: 6px; background: rgba(255,255,255,.05); }
.requirement span { min-width: 72px; font-size: 11px; font-weight: 800; text-transform: uppercase; } .ready { color: #83eee4; } .blocked { color: #ffcf8a; }
.action-panel, .destination-panel, .destination-form, .credentials { display: grid; gap: 12px; } .action-panel .button { justify-self: start; }
.credentials > div { display: grid; grid-template-columns: 130px minmax(0,1fr) auto; align-items: center; gap: 10px; } code { overflow: hidden; text-overflow: ellipsis; color: #dce8ec; }
.destination-form { grid-template-columns: minmax(0,1fr) minmax(220px,.6fr) auto; align-items: end; } label { display: grid; gap: 6px; font-size: 12px; font-weight: 800; }
input { min-height: 38px; padding: 0 10px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #090d12; color: #fff; }
.destination-list { display: grid; gap: 8px; } .destination-list article { padding: 11px; border-radius: 6px; background: rgba(255,255,255,.05); } .destination-list article > div:first-child { display: grid; gap: 4px; min-width: 0; } .destination-list strong { overflow: hidden; text-overflow: ellipsis; }
.destination-list span, .muted { color: #a7b6bf; } .danger { color: #ffb4a4; } details summary { cursor: pointer; color: #fff; font-weight: 800; } .limitations ul { margin-bottom: 0; }
@media (max-width: 720px) { .outputs-header, .destination-list article { align-items: flex-start; flex-direction: column; } .destination-form, .credentials > div { grid-template-columns: 1fr; } }
</style>
