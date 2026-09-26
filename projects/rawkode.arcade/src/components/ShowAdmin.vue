<script setup lang="ts">
import { onMounted, ref } from "vue";
import { css } from "@/../styled-system/css";
import { games } from "@/lib/game-catalogue";
import { control, field, notice, shell, slug, text } from "@/styles/arcade";

const page = css({ display: "grid", gap: "sectionTight", py: "section" });
const intro = css({ display: "grid", gap: "4", maxW: "prose" });
const actions = css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3", mt: "4" });
const showList = css({ display: "grid", gap: "5" });
const showRow = css({ display: "grid", gridTemplateColumns: { base: "1fr", md: "1fr auto" }, gap: "5", py: "5", borderTopWidth: "hairline", borderTopStyle: "solid", borderTopColor: "rule" });
const showInfo = css({ display: "grid", alignContent: "start", gap: "3" });
const showActions = css({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: { base: "start", md: "end" }, gap: "3", maxW: "formColumn" });
const formatLabel = css({ display: "grid", gap: "2" });

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
	<div :class="[shell, page]">
		<header :class="intro">
			<p :class="slug()">Producer dashboard</p>
			<h1 :class="text({ style: 'display' })">Manage live shows</h1>
			<p :class="text({ tone: 'soft' })">Schedule and broadcast in Rawkode Studio. Turn audience participation on only for shows that need it.</p>
			<div :class="actions">
				<a :class="control({ tone: 'action' })" href="https://rawkode.studio/">Schedule a show in Studio ↗</a>
				<a :class="control({ tone: 'quiet' })" href="/admin/content">Interactive content</a>
			</div>
		</header>
		<p v-if="error" :class="notice({ tone: 'error' })" role="alert">{{ error }} <a v-if="signIn" href="/auth/sign-in?returnTo=/admin">Sign in</a></p>
		<p v-if="loading" :class="text({ tone: 'soft' })" role="status">Loading shows…</p>
		<p v-else-if="!shows.length && !error" :class="text({ tone: 'soft' })">No production shows are scheduled. Create one in Studio to see it here.</p>
		<div v-else :class="showList">
			<article v-for="show in shows" :key="show.id" :class="showRow">
				<div :class="showInfo">
					<p :class="slug({ tone: show.playbackUrl ? 'live' : 'default' })">{{ show.playbackUrl ? "Live now" : dateLabel(show.startsAt) }} · {{ show.show }}</p>
					<h2 :class="text({ style: 'title' })">{{ show.title }}</h2>
					<p :class="text({ tone: 'soft' })">Audience participation: {{ show.participation?.enabled ? "enabled" : "off" }}</p>
				</div>
				<div :class="showActions">
					<a :class="control({ tone: 'quiet' })" :href="`https://rawkode.studio/studio/${encodeURIComponent(show.id)}/producer`">{{ show.playbackUrl ? "Open live controls ↗" : "Prepare / go live ↗" }}</a>
					<template v-if="show.participation">
						<a :class="control({ tone: 'quiet' })" :href="`/host/${encodeURIComponent(show.participation.roomId)}`">Interactive room</a>
						<button :class="control({ tone: 'action' })" :disabled="pending === show.id" @click="setParticipation(show, !show.participation.enabled)">
							{{ show.participation.enabled ? "Turn participation off" : "Turn participation on" }}
						</button>
					</template>
					<template v-else>
						<label :class="[formatLabel, text({ style: 'bodySm' })]">Interactive format
							<select v-model="choices[show.id]" :class="field()">
								<option v-for="game in games" :key="game.id" :value="game.id">{{ game.title }}</option>
							</select>
						</label>
						<button :class="control({ tone: 'action' })" :disabled="pending === show.id" @click="setParticipation(show, false)">Prepare participation</button>
					</template>
				</div>
			</article>
		</div>
	</div>
</template>
