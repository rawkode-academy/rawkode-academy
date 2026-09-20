<script setup lang="ts">
import type { LeaderboardEntry } from "@/lib/live-contract";
defineProps<{ entries: readonly LeaderboardEntry[]; title?: string }>();
</script>
<template>
	<section class="leaderboard" :aria-label="title ?? 'Leaderboard'">
		<div class="table-heading"><span>{{ title ?? 'Global leaderboard' }}</span><a href="/leaderboard">View all <span aria-hidden="true">→</span></a></div>
		<ol>
			<li v-for="entry in entries" :key="entry.name">
				<span class="rank">{{ entry.rank }}</span><span class="avatar">{{ entry.avatar }}</span><strong>{{ entry.name }}</strong><span v-if="entry.delta" :class="['delta', { down: entry.delta < 0 }]">{{ entry.delta > 0 ? '↑' : '↓' }}{{ Math.abs(entry.delta) }}</span><b>{{ entry.score.toLocaleString() }}</b>
			</li>
		</ol>
	</section>
</template>
<style scoped>
.leaderboard { background: rgb(16 26 53 / 70%); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }.table-heading { align-items: center; border-bottom: 1px solid var(--line); color: var(--mist); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .65rem; justify-content: space-between; letter-spacing: .08em; padding: .75rem .9rem; text-transform: uppercase; }.table-heading a { color: var(--cyan); font-family: Inter, sans-serif; font-size: .72rem; font-weight: 700; letter-spacing: 0; text-transform: none; }ol { list-style: none; margin: 0; padding: 0; }li { align-items: center; border-bottom: 1px solid rgb(174 187 217 / 11%); display: grid; gap: .55rem; grid-template-columns: 1.1rem 1.75rem 1fr auto auto; min-height: 47px; padding: .45rem .75rem; }li:last-child { border: 0; }.rank { color: var(--mist); font-family: "IBM Plex Mono", monospace; font-size: .72rem; }.avatar { align-items: center; background: linear-gradient(135deg, var(--violet), var(--cyan)); border-radius: 7px; color: var(--ink); display: flex; font-family: "IBM Plex Mono", monospace; font-size: .55rem; font-weight: 700; height: 25px; justify-content: center; width: 25px; }strong { font-size: .78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.delta { color: var(--lime); font-family: "IBM Plex Mono", monospace; font-size: .62rem; }.delta.down { color: var(--coral); }b { font-family: "Space Grotesk", sans-serif; font-size: .9rem; }
</style>
