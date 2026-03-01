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
	scheduledAt: Date | null;
	streamUrl: string | null;
	bracket: Bracket | null;
	competitor1: Competitor | null;
	competitor2: Competitor | null;
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

function formatScheduledTime(date: Date | null): string {
	if (!date) return "TBD";
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function isUpcomingSoon(date: Date | null): boolean {
	if (!date) return false;
	const now = new Date();
	const matchTime = new Date(date);
	const hoursDiff = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60);
	return hoursDiff < 24 && hoursDiff > 0;
}
</script>

<template>
	<div class="upcoming-matches">
		<h3 class="section-title">Upcoming Matches</h3>

		<div v-if="matches.length === 0" class="empty-state">
			No scheduled matches
		</div>

		<div v-else class="matches-list">
			<div
				v-for="match in matches"
				:key="match.id"
				:class="['match-item', { 'upcoming-soon': isUpcomingSoon(match.scheduledAt) }]"
			>
				<div class="match-time">
					<span v-if="isUpcomingSoon(match.scheduledAt)" class="soon-badge">Soon</span>
					<span class="time-text">{{ formatScheduledTime(match.scheduledAt) }}</span>
				</div>

				<div class="match-content">
					<div class="matchup">
						<div class="competitor">
							<img
								v-if="match.competitor1?.imageUrl"
								:src="match.competitor1.imageUrl"
								:alt="getCompetitorName(match.competitor1)"
								class="competitor-avatar"
							/>
							<div v-else class="competitor-avatar placeholder">
								{{ getCompetitorName(match.competitor1).charAt(0).toUpperCase() }}
							</div>
							<span class="competitor-name">{{ getCompetitorName(match.competitor1) }}</span>
						</div>

						<span class="vs-text">vs</span>

						<div class="competitor">
							<img
								v-if="match.competitor2?.imageUrl"
								:src="match.competitor2.imageUrl"
								:alt="getCompetitorName(match.competitor2)"
								class="competitor-avatar"
							/>
							<div v-else class="competitor-avatar placeholder">
								{{ getCompetitorName(match.competitor2).charAt(0).toUpperCase() }}
							</div>
							<span class="competitor-name">{{ getCompetitorName(match.competitor2) }}</span>
						</div>
					</div>

					<div class="match-meta">
						<span class="bracket-name">{{ match.bracket?.name }}</span>
						<span class="round-name">{{ getRoundName(match.round) }}</span>
					</div>
				</div>

				<a
					v-if="match.streamUrl"
					:href="match.streamUrl"
					target="_blank"
					rel="noopener"
					class="stream-link"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
						<path d="M8 5v14l11-7z"/>
					</svg>
				</a>
			</div>
		</div>
	</div>
</template>

<style scoped>
.upcoming-matches {
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

.matches-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.match-item {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
	padding: 0.75rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	transition: all 0.2s;
}

.match-item.upcoming-soon {
	border-color: rgba(251, 191, 36, 0.3);
	background: rgba(251, 191, 36, 0.05);
}

@media (min-width: 640px) {
	.match-item {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
}

.match-time {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	min-width: 160px;
}

.soon-badge {
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	color: #fde047;
	background: rgba(251, 191, 36, 0.2);
	padding: 0.125rem 0.375rem;
	border-radius: 0.25rem;
}

.time-text {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.7);
}

.match-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

@media (min-width: 768px) {
	.match-content {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}
}

.matchup {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.competitor {
	display: flex;
	align-items: center;
	gap: 0.375rem;
}

.competitor-avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	object-fit: cover;
}

.competitor-avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(139, 92, 246, 0.3);
	color: white;
	font-weight: 600;
	font-size: 0.625rem;
}

.competitor-name {
	font-size: 0.875rem;
	font-weight: 500;
	color: white;
}

.vs-text {
	font-size: 0.625rem;
	color: rgba(255, 255, 255, 0.4);
	text-transform: uppercase;
}

.match-meta {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.75rem;
}

.bracket-name {
	color: rgba(255, 255, 255, 0.5);
}

.round-name {
	color: #a5b4fc;
}

.stream-link {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 0.5rem;
	background: rgba(139, 92, 246, 0.2);
	color: #c4b5fd;
	transition: all 0.2s;
}

.stream-link:hover {
	background: rgba(139, 92, 246, 0.3);
	color: white;
}
</style>
