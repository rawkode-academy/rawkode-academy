<script setup lang="ts">
import type { TeamScore } from "@/lib/live-contract";
defineProps<{ teams: readonly TeamScore[]; compact?: boolean }>();
</script>
<template>
	<section class="team-rail" aria-label="Live team scores" data-testid="team-roster" aria-live="polite">
		<div v-for="(team, index) in teams" :key="team.id" class="team" :class="{ leading: index === 0, compact }">
			<div class="team-name"><i :style="{ background: team.colour }"></i><span>{{ team.name }}</span><em v-if="team.streak">{{ team.streak }}× streak</em></div>
			<strong :data-testid="`score-${team.id}`">{{ team.score.toLocaleString() }}</strong>
		</div>
	</section>
</template>
<style scoped>
.team-rail { display: grid; gap: .55rem; }.team { align-items: center; background: rgb(24 38 74 / 48%); border: 1px solid var(--line); border-radius: 11px; display: flex; justify-content: space-between; min-width: 0; padding: .75rem .8rem; }.team.leading { border-color: rgb(77 232 255 / 46%); }.team-name { align-items: center; display: flex; gap: .5rem; min-width: 0; }.team-name i { border-radius: 50%; flex: 0 0 auto; height: 9px; width: 9px; }.team-name span { font-size: .82rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.team-name em { color: var(--lime); font-family: "IBM Plex Mono", monospace; font-size: .6rem; font-style: normal; white-space: nowrap; }.team strong { font-family: "Space Grotesk", sans-serif; font-size: 1.1rem; letter-spacing: -.04em; }.compact { padding: .5rem .6rem; }.compact .team-name span { font-size: .72rem; }.compact strong { font-size: .9rem; }
</style>
