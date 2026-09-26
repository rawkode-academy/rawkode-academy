<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { css } from "@/../styled-system/css";
import { control, shell, slug, stage, text } from "@/styles/arcade";
import ShowPlayer from "@/components/ShowPlayer.vue";

const page = css({ display: "grid", gap: "section", py: "section" });
const intro = css({ display: "grid", gap: "4", maxW: "prose" });
const show = css({ display: "grid", gap: "5" });
const heading = css({ display: "grid", gap: "3" });
const state = css({ display: "grid", alignContent: "center", gap: "4", minH: "route" });
const participation = css({ display: "flex", flexDirection: { base: "column", sm: "row" }, alignItems: { base: "stretch", sm: "center" }, justifyContent: "space-between", gap: "5", borderTopWidth: "rule", borderTopStyle: "solid", borderTopColor: "crowd", py: "5" });
const upcoming = css({ display: "grid", gap: "4" });
const upcomingList = css({ listStyle: "none", p: "0", m: "0", borderTopWidth: "hairline", borderTopStyle: "solid", borderTopColor: "rule" });
const upcomingItem = css({ display: "grid", gridTemplateColumns: { base: "1fr", md: "1fr 2fr 1fr" }, gap: "3", py: "4", borderBottomWidth: "hairline", borderBottomStyle: "solid", borderBottomColor: "rule" });

type Show = { id: string; title: string; show: string; startsAt: string };
type LiveShow = Show & { playbackUrl: string; startedAt: number | null };
type Lineup = {
	live: LiveShow | null;
	upcoming: Show[];
	participation: { roomId: string; gameKey: string } | null;
};

const lineup = ref<Lineup>();
const unavailable = ref(false);
let timer: number | undefined;

function dateLabel(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Time to be announced";
	if (date.getTime() < Date.now()) return "Starting soon";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "full", timeStyle: "short",
	}).format(date);
}

async function refresh() {
	try {
		const response = await fetch("/api/show-lineup", { cache: "no-store" });
		if (!response.ok) throw new Error("Show schedule unavailable");
		lineup.value = await response.json() as Lineup;
		unavailable.value = false;
	} catch {
		lineup.value = undefined;
		unavailable.value = true;
	}
}

onMounted(() => {
	void refresh();
	timer = window.setInterval(() => void refresh(), 15_000);
});
onUnmounted(() => { if (timer !== undefined) window.clearInterval(timer); });
</script>

<template>
	<div :class="[shell, page]">
		<header :class="intro">
			<p :class="slug()">Rawkode Academy · Live shows</p>
			<h1 :class="text({ style: 'display' })">Watch the show.</h1>
			<p :class="text({ tone: 'soft' })">The programme appears here when the producer goes live. Some shows invite you to take part; every show is free to watch.</p>
		</header>

		<section v-if="unavailable" :class="[stage({ pad: 'comfortable' }), state]" role="status">
			<h2 :class="text({ style: 'headline' })">Show schedule is temporarily unavailable.</h2>
			<p :class="text({ tone: 'soft' })">Check back shortly.</p>
		</section>
		<section v-else-if="!lineup" :class="[stage({ pad: 'comfortable' }), state]" role="status">
			<h2 :class="text({ style: 'headline' })">Loading the show schedule…</h2>
		</section>
		<section v-else-if="lineup.live" :class="show" aria-label="Live show">
			<div :class="heading">
				<p :class="slug({ tone: 'live' })">● Live now · {{ lineup.live.show }}</p>
				<h2 :class="text({ style: 'headline' })">{{ lineup.live.title }}</h2>
			</div>
			<ShowPlayer :key="`${lineup.live.id}:${lineup.live.playbackUrl}`" :title="lineup.live.title" :playback-url="lineup.live.playbackUrl" />
			<div v-if="lineup.participation" :class="participation">
				<div>
					<h3 :class="text({ style: 'title' })">Join the audience</h3>
					<p :class="text({ tone: 'soft' })">Participation is open for this show. Keep the stream here and open the audience view on another device or tab.</p>
				</div>
				<a :class="control({ tone: 'action' })" :href="`/audience/${encodeURIComponent(lineup.participation.roomId)}`" target="_blank" rel="noopener">Take part ↗</a>
			</div>
		</section>
		<section v-else :class="[stage({ pad: 'comfortable' }), state]" role="status">
			<p :class="slug()">Off air</p>
			<h2 v-if="lineup.upcoming.length" :class="text({ style: 'headline' })">Next show: {{ lineup.upcoming[0].title }}</h2>
			<h2 v-else :class="text({ style: 'headline' })">No show is scheduled right now.</h2>
			<p v-if="lineup.upcoming.length" :class="text({ tone: 'soft' })">{{ dateLabel(lineup.upcoming[0].startsAt) }}</p>
			<p v-else :class="text({ tone: 'soft' })">Come back for the next live programme.</p>
		</section>

		<section v-if="lineup?.upcoming.length" id="upcoming" :class="upcoming" aria-label="Upcoming shows">
			<h2 :class="text({ style: 'title' })">Coming up</h2>
			<ol :class="upcomingList">
				<li v-for="show in lineup.upcoming" :key="show.id" :class="upcomingItem">
					<span :class="text({ style: 'bodySm', tone: 'soft' })">{{ dateLabel(show.startsAt) }}</span>
					<strong :class="text({ style: 'title' })">{{ show.title }}</strong>
					<small :class="text({ style: 'bodySm', tone: 'soft' })">{{ show.show }}</small>
				</li>
			</ol>
		</section>
	</div>
</template>
