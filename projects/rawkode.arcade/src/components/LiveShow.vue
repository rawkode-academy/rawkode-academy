<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import ShowPlayer from "@/components/ShowPlayer.vue";

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
	<div class="show-page">
		<header class="show-intro">
			<p class="eyebrow">Rawkode Academy · Live shows</p>
			<h1>Watch the show.</h1>
			<p>The programme appears here when the producer goes live. Some shows invite you to take part; every show is free to watch.</p>
		</header>

		<section v-if="unavailable" class="show-state" role="status">
			<h2>Show schedule is temporarily unavailable.</h2>
			<p>Check back shortly.</p>
		</section>
		<section v-else-if="!lineup" class="show-state" role="status">
			<h2>Loading the show schedule…</h2>
		</section>
		<section v-else-if="lineup.live" class="live-show" aria-label="Live show">
			<div class="live-heading">
				<p class="eyebrow on-air">● Live now · {{ lineup.live.show }}</p>
				<h2>{{ lineup.live.title }}</h2>
			</div>
			<ShowPlayer :key="`${lineup.live.id}:${lineup.live.playbackUrl}`" :title="lineup.live.title" :playback-url="lineup.live.playbackUrl" />
			<div v-if="lineup.participation" class="participation">
				<div>
					<h3>Join the audience</h3>
					<p>Participation is open for this show. Keep the stream here and open the audience view on another device or tab.</p>
				</div>
				<a :href="`/audience/${encodeURIComponent(lineup.participation.roomId)}`" target="_blank" rel="noopener">Take part ↗</a>
			</div>
		</section>
		<section v-else class="show-state" role="status">
			<p class="eyebrow">Off air</p>
			<h2 v-if="lineup.upcoming.length">Next show: {{ lineup.upcoming[0].title }}</h2>
			<h2 v-else>No show is scheduled right now.</h2>
			<p v-if="lineup.upcoming.length">{{ dateLabel(lineup.upcoming[0].startsAt) }}</p>
			<p v-else>Come back for the next live programme.</p>
		</section>

		<section v-if="lineup?.upcoming.length" id="upcoming" class="upcoming" aria-label="Upcoming shows">
			<h2>Coming up</h2>
			<ol>
				<li v-for="show in lineup.upcoming" :key="show.id">
					<span>{{ dateLabel(show.startsAt) }}</span>
					<strong>{{ show.title }}</strong>
					<small>{{ show.show }}</small>
				</li>
			</ol>
		</section>
	</div>
</template>

<style scoped>
.show-page { max-width: 70rem; margin: 0 auto; padding: clamp(2rem, 6vw, 5rem) 1.5rem; display: grid; gap: 3.5rem; }
.show-intro { max-width: 44rem; }
.eyebrow { margin: 0 0 1rem; text-transform: uppercase; letter-spacing: .13em; font-size: .75rem; font-weight: 700; }
.show-intro h1 { font-size: clamp(3rem, 9vw, 6rem); line-height: 1; letter-spacing: -.05em; margin: 0 0 1.25rem; }
.show-intro p:last-child, .show-state p, .participation p { color: #a7aab2; line-height: 1.6; }
.live-show { display: grid; gap: 1.5rem; }
.live-heading h2, .show-state h2 { font-size: clamp(1.8rem, 5vw, 3rem); line-height: 1.1; margin: 0; }
.on-air { color: #ff684d; }
.show-state { min-height: 18rem; padding: clamp(2rem, 5vw, 4rem); display: grid; align-content: center; gap: 1rem; border: 1px solid #353943; border-radius: .75rem; background: #14161b; }
.show-state p { margin: 0; }
.participation { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 1.5rem; border: 1px solid #4a6247; border-radius: .75rem; }
.participation h3 { margin: 0 0 .35rem; font-size: 1.3rem; }
.participation p { margin: 0; }
.participation a { flex: none; padding: .85rem 1.2rem; border-radius: .35rem; background: #d9f069; color: #10120c; font-weight: 700; text-decoration: none; }
.upcoming { display: grid; gap: 1rem; }
.upcoming h2 { margin: 0; font-size: 1.5rem; }
.upcoming ol { list-style: none; padding: 0; margin: 0; border-top: 1px solid #353943; }
.upcoming li { display: grid; grid-template-columns: minmax(10rem, 1fr) minmax(12rem, 2fr) minmax(8rem, 1fr); gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #353943; }
.upcoming small, .upcoming span { color: #a7aab2; }
@media (max-width: 42rem) { .participation { align-items: stretch; flex-direction: column; } .upcoming li { grid-template-columns: 1fr; gap: .25rem; } }
</style>
