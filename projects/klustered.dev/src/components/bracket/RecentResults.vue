<script setup lang="ts">
interface Competitor {
	id: string;
	name: string;
	displayName: string | null;
	imageUrl: string | null;
}

interface Bracket {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
}

interface Match {
	id: string;
	round: number;
	vodUrl: string | null;
	bracket: Bracket | null;
	competitor1: Competitor | null;
	competitor2: Competitor | null;
	winner: Competitor | null;
}

defineProps<{
	matches: Match[];
}>();

function getCompetitorName(competitor: Competitor | null): string {
	if (!competitor) return "TBD";
	return competitor.displayName || competitor.name;
}

function getRoundName(round: number, totalRounds: number = 4): string {
	const roundsFromEnd = totalRounds - round;
	if (roundsFromEnd === 0) return "Finals";
	if (roundsFromEnd === 1) return "Semi-Finals";
	if (roundsFromEnd === 2) return "Quarter-Finals";
	return `Round ${round}`;
}

function getLoser(match: Match): Competitor | null {
	if (!match.winner) return null;
	if (match.winner.id === match.competitor1?.id) return match.competitor2;
	return match.competitor1;
}
</script>

<template>
	<div class="recent-results">
		<h3 class="section-title">Recent Results</h3>

		<div v-if="matches.length === 0" class="empty-state">
			No completed matches yet
		</div>

		<div v-else class="results-list">
			<div
				v-for="match in matches"
				:key="match.id"
				class="result-item"
			>
				<div class="result-content">
					<div class="competitor winner">
						<img
							v-if="match.winner?.imageUrl"
							:src="match.winner.imageUrl"
							:alt="getCompetitorName(match.winner)"
							class="competitor-avatar"
						/>
						<div v-else class="competitor-avatar placeholder">
							{{ getCompetitorName(match.winner).charAt(0).toUpperCase() }}
						</div>
						<span class="competitor-name">{{ getCompetitorName(match.winner) }}</span>
						<span class="winner-badge">W</span>
					</div>

					<span class="vs-text">def.</span>

					<div class="competitor loser">
						<img
							v-if="getLoser(match)?.imageUrl"
							:src="getLoser(match)?.imageUrl"
							:alt="getCompetitorName(getLoser(match))"
							class="competitor-avatar"
						/>
						<div v-else class="competitor-avatar placeholder loser-avatar">
							{{ getCompetitorName(getLoser(match)).charAt(0).toUpperCase() }}
						</div>
						<span class="competitor-name loser-name">{{ getCompetitorName(getLoser(match)) }}</span>
					</div>
				</div>

				<div class="result-meta">
					<span class="bracket-name">{{ match.bracket?.name }}</span>
					<span class="round-name">{{ getRoundName(match.round) }}</span>
					<a
						v-if="match.vodUrl"
						:href="match.vodUrl"
						target="_blank"
						rel="noopener"
						class="vod-link"
						title="Watch VOD"
					>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						VOD
					</a>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.recent-results {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.section-title {
	font-size: 1rem;
	font-weight: 600;
	color: white;
	margin: 0;
}

.empty-state {
	padding: 1.5rem;
	text-align: center;
	color: rgba(255, 255, 255, 0.5);
	font-size: 0.875rem;
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0.75rem;
}

.results-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.result-item {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
	padding: 0.75rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

@media (min-width: 640px) {
	.result-item {
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}
}

.result-content {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-wrap: wrap;
}

.competitor {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.competitor-avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	object-fit: cover;
}

.competitor-avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(34, 197, 94, 0.3);
	color: white;
	font-weight: 600;
	font-size: 0.75rem;
}

.competitor-avatar.loser-avatar {
	background: rgba(255, 255, 255, 0.1);
}

.competitor-name {
	font-size: 0.875rem;
	font-weight: 500;
	color: white;
}

.competitor-name.loser-name {
	color: rgba(255, 255, 255, 0.5);
}

.winner-badge {
	font-size: 0.625rem;
	font-weight: 700;
	color: #86efac;
	background: rgba(34, 197, 94, 0.2);
	padding: 0.125rem 0.375rem;
	border-radius: 0.25rem;
}

.vs-text {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.4);
}

.result-meta {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	font-size: 0.75rem;
}

.bracket-name {
	color: rgba(255, 255, 255, 0.5);
}

.round-name {
	color: #a5b4fc;
}

.vod-link {
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	color: #a78bfa;
	text-decoration: none;
	padding: 0.25rem 0.5rem;
	background: rgba(139, 92, 246, 0.1);
	border-radius: 0.25rem;
	transition: all 0.2s;
}

.vod-link:hover {
	background: rgba(139, 92, 246, 0.2);
	color: #c4b5fd;
}
</style>
