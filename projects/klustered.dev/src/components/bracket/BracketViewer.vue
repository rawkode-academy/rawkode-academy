<script setup lang="ts">
import { computed } from "vue";
import BracketRound from "./BracketRound.vue";

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

interface Bracket {
	id: string;
	name: string;
	type: "solo" | "team";
	status: "draft" | "registration" | "active" | "completed";
}

const props = defineProps<{
	bracket: Bracket;
	competitors: Competitor[];
	matches: Match[];
}>();

const totalRounds = computed(() => {
	if (props.matches.length === 0) return 0;
	return Math.max(...props.matches.map((m) => m.round));
});

const matchesByRound = computed(() => {
	const grouped: Record<number, Match[]> = {};
	for (let i = 1; i <= totalRounds.value; i++) {
		grouped[i] = props.matches
			.filter((m) => m.round === i)
			.sort((a, b) => a.position - b.position);
	}
	return grouped;
});

function getRoundName(round: number): string {
	const roundsFromFinal = totalRounds.value - round;

	switch (roundsFromFinal) {
		case 0:
			return "Final";
		case 1:
			return "Semi-Finals";
		case 2:
			return "Quarter-Finals";
		default:
			return `Round ${round}`;
	}
}

function getCompetitor(id: string | null): Competitor | undefined {
	if (!id) return undefined;
	return props.competitors.find((c) => c.id === id);
}

const champion = computed(() => {
	if (props.bracket.status !== "completed") return null;
	const finalMatch = props.matches.find((m) => m.round === totalRounds.value);
	if (!finalMatch?.winnerId) return null;
	return props.competitors.find((c) => c.id === finalMatch.winnerId);
});
</script>

<template>
	<div class="bracket-viewer">
		<div v-if="champion" class="champion-banner">
			<div class="champion-label">Champion</div>
			<div class="champion-info">
				<img
					v-if="champion.imageUrl"
					:src="champion.imageUrl"
					:alt="champion.displayName || champion.name"
					class="champion-avatar"
				/>
				<span class="champion-name">{{ champion.displayName || champion.name }}</span>
			</div>
		</div>

		<div v-if="matches.length === 0" class="empty-state">
			<p>Bracket not yet generated.</p>
			<p>Check back soon!</p>
		</div>

		<div v-else class="bracket-container">
			<div class="rounds-wrapper">
				<BracketRound
					v-for="round in totalRounds"
					:key="round"
					:round="round"
					:roundName="getRoundName(round)"
					:matches="matchesByRound[round] || []"
					:getCompetitor="getCompetitor"
					:totalRounds="totalRounds"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.bracket-viewer {
	width: 100%;
}

.champion-banner {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
	padding: 2rem;
	margin-bottom: 2rem;
	background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.05));
	border: 1px solid rgba(251, 191, 36, 0.3);
	border-radius: 1rem;
	text-align: center;
}

.champion-label {
	font-size: 0.75rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.2em;
	color: #fbbf24;
}

.champion-info {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.champion-avatar {
	width: 3rem;
	height: 3rem;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid #fbbf24;
}

.champion-name {
	font-size: 1.5rem;
	font-weight: 700;
	color: white;
}

.empty-state {
	text-align: center;
	padding: 4rem 2rem;
	background: rgba(255, 255, 255, 0.02);
	border-radius: 1rem;
	color: rgba(255, 255, 255, 0.5);
}

.empty-state p {
	margin: 0.5rem 0;
}

.bracket-container {
	overflow-x: auto;
	padding-bottom: 1rem;
}

.rounds-wrapper {
	display: flex;
	gap: 1rem;
	min-width: max-content;
}
</style>
