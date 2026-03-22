<script setup lang="ts">
import MatchCard from "./MatchCard.vue";

interface Competitor {
	id: string;
	name: string;
	displayName: string | null;
	imageUrl: string | null;
	seed: number | null;
}

interface Match {
	id: string;
	round: number;
	position: number;
	competitor1Id: string | null;
	competitor2Id: string | null;
	winnerId: string | null;
	status: "pending" | "scheduled" | "live" | "completed";
	streamUrl: string | null;
	vodUrl: string | null;
}

defineProps<{
	round: number;
	roundName: string;
	matches: Match[];
	getCompetitor: (id: string | null) => Competitor | undefined;
	totalRounds: number;
}>();
</script>

<template>
	<div class="bracket-round">
		<div class="round-header">
			<h3 class="round-name">{{ roundName }}</h3>
			<span class="match-count">{{ matches.length }} match{{ matches.length !== 1 ? 'es' : '' }}</span>
		</div>

		<div class="matches-column" :style="{ '--round': round, '--total-rounds': totalRounds }">
			<MatchCard
				v-for="match in matches"
				:key="match.id"
				:match="match"
				:competitor1="getCompetitor(match.competitor1Id)"
				:competitor2="getCompetitor(match.competitor2Id)"
				:winner="getCompetitor(match.winnerId)"
			/>
		</div>
	</div>
</template>

<style scoped>
.bracket-round {
	display: flex;
	flex-direction: column;
	min-width: 280px;
}

.round-header {
	display: flex;
	align-items: baseline;
	gap: 0.75rem;
	margin-bottom: 1rem;
	padding-bottom: 0.5rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.round-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: #a78bfa;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin: 0;
}

.match-count {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.4);
}

.matches-column {
	display: flex;
	flex-direction: column;
	gap: calc(1rem * pow(2, var(--round) - 1));
	padding-top: calc(0.5rem * (pow(2, var(--round) - 1) - 1));
}
</style>
