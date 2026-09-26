<script setup lang="ts">
import { onMounted, ref } from "vue";
import { games } from "@/lib/game-catalogue";

type Participation = { roomId: string; enabled: boolean; gameKey: string };
type Show = { id: string; title: string; show: string; startsAt: string; playbackUrl?: string; participation?: Participation };

const shows = ref<Show[]>([]);
const choices = ref<Record<string, string>>({});
const pending = ref<string>();
const error = ref("");
const loading = ref(true);
const signIn = ref(false);

function dateLabel(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Time to be announced" : new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium", timeStyle: "short",
	}).format(date);
}

async function load() {
	loading.value = true;
	error.value = "";
	try {
		const response = await fetch("/api/admin/show-lineup", { credentials: "same-origin", cache: "no-store" });
		if (response.status === 403) signIn.value = true;
		if (!response.ok) throw new Error(response.status === 403 ? "Sign in with an Academy producer account to manage shows." : "Unable to load the show schedule.");
		shows.value = ((await response.json()) as { shows: Show[] }).shows;
	} catch (cause) {
		error.value = cause instanceof Error ? cause.message : "Unable to load shows.";
	} finally { loading.value = false; }
}

async function setParticipation(show: Show, enabled: boolean) {
	pending.value = show.id;
	error.value = "";
	try {
		const response = await fetch(`/api/admin/shows/${encodeURIComponent(show.id)}/participation`, {
			method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
			body: JSON.stringify({ enabled, ...(show.participation ? {} : { gameKey: choices.value[show.id] ?? games[0].id }) }),
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
			throw new Error(body?.error?.message ?? "Could not change participation.");
		}
		show.participation = ((await response.json()) as { participation: Participation }).participation;
	} catch (cause) {
		error.value = cause instanceof Error ? cause.message : "Could not change participation.";
	} finally { pending.value = undefined; }
}

onMounted(() => void load());
</script>

<template>
	<div class="producer-page">
		<header>
			<p class="eyebrow">Producer dashboard</p>
			<h1>Manage live shows</h1>
			<p>Schedule and broadcast in Rawkode Studio. Turn audience participation on only for shows that need it.</p>
			<div class="actions">
				<a class="primary" href="https://rawkode.studio/">Schedule a show in Studio ↗</a>
				<a href="/admin/content">Interactive content</a>
			</div>
		</header>
		<p v-if="error" class="error" role="alert">{{ error }} <a v-if="signIn" href="/auth/sign-in?returnTo=/admin">Sign in</a></p>
		<p v-if="loading" role="status">Loading shows…</p>
		<p v-else-if="!shows.length && !error">No production shows are scheduled. Create one in Studio to see it here.</p>
		<div v-else class="show-list">
			<article v-for="show in shows" :key="show.id" class="show-row">
				<div>
					<p class="eyebrow">{{ show.playbackUrl ? "Live now" : dateLabel(show.startsAt) }} · {{ show.show }}</p>
					<h2>{{ show.title }}</h2>
					<p>Audience participation: {{ show.participation?.enabled ? "enabled" : "off" }}</p>
				</div>
				<div class="show-actions">
					<a :href="`https://rawkode.studio/studio/${encodeURIComponent(show.id)}/producer`">{{ show.playbackUrl ? "Open live controls ↗" : "Prepare / go live ↗" }}</a>
					<template v-if="show.participation">
						<a :href="`/host/${encodeURIComponent(show.participation.roomId)}`">Interactive room</a>
						<button :disabled="pending === show.id" @click="setParticipation(show, !show.participation.enabled)">
							{{ show.participation.enabled ? "Turn participation off" : "Turn participation on" }}
						</button>
					</template>
					<template v-else>
						<label>Interactive format
							<select v-model="choices[show.id]">
								<option v-for="game in games" :key="game.id" :value="game.id">{{ game.title }}</option>
							</select>
						</label>
						<button :disabled="pending === show.id" @click="setParticipation(show, false)">Prepare participation</button>
					</template>
				</div>
			</article>
		</div>
	</div>
</template>

<style scoped>
.producer-page { max-width: 68rem; margin: 0 auto; padding: clamp(2rem, 6vw, 5rem) 1.5rem; display: grid; gap: 3rem; }
.producer-page header { max-width: 48rem; }
.eyebrow { margin: 0 0 .5rem; font-size: .75rem; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0 0 1rem; font-size: clamp(2.5rem, 6vw, 4rem); line-height: 1; }
h2 { margin: 0 0 .5rem; font-size: 1.5rem; }
header p, .show-row p { color: #a7aab2; }
.actions, .show-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1.25rem; }
.actions a, .show-actions a, button { display: inline-block; border: 1px solid #4c515e; border-radius: .35rem; padding: .65rem 1rem; background: #191c22; color: #f7f7f7; text-decoration: none; font: inherit; cursor: pointer; }
.actions .primary { background: #d9f069; color: #10120c; border-color: #d9f069; font-weight: 700; }
button:disabled { opacity: .5; cursor: wait; }
.error { padding: 1rem; border: 1px solid #b4564d; color: #ffb3aa; }
.error a { color: inherit; }
.show-list { display: grid; gap: 1rem; }
.show-row { display: grid; grid-template-columns: 1fr auto; gap: 2rem; padding: 1.5rem; border: 1px solid #353943; border-radius: .5rem; }
.show-actions { max-width: 26rem; justify-content: end; margin: 0; }
label { display: grid; gap: .3rem; font-size: .85rem; }
select { padding: .55rem; color: #f7f7f7; background: #191c22; border: 1px solid #4c515e; }
@media (max-width: 44rem) { .show-row { grid-template-columns: 1fr; } .show-actions { justify-content: start; } }
</style>
