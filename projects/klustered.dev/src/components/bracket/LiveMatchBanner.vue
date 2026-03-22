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
	streamUrl: string | null;
	bracket: Bracket | null;
	competitor1: Competitor | null;
	competitor2: Competitor | null;
}

defineProps<{
	match: Match;
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
</script>

<template>
	<div class="live-banner">
		<div class="live-indicator">
			<span class="live-dot"></span>
			<span class="live-text">LIVE NOW</span>
		</div>

		<div class="match-content">
			<div class="competitor competitor-1">
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

			<div class="versus">
				<span class="vs-text">VS</span>
			</div>

			<div class="competitor competitor-2">
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

		<div class="match-context">
			<span class="bracket-name">{{ match.bracket?.name }}</span>
			<span class="round-name">{{ getRoundName(match.round) }}</span>
		</div>

		<a
			v-if="match.streamUrl"
			:href="match.streamUrl"
			target="_blank"
			rel="noopener"
			class="watch-button"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
				<path d="M8 5v14l11-7z"/>
			</svg>
			Watch Live
		</a>
	</div>
</template>

<style scoped>
.live-banner {
	background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1));
	border: 1px solid rgba(239, 68, 68, 0.4);
	border-radius: 1rem;
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	position: relative;
	overflow: hidden;
}

.live-banner::before {
	content: "";
	position: absolute;
	inset: 0;
	background: radial-gradient(ellipse at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%);
	animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
	0%, 100% { opacity: 0.5; }
	50% { opacity: 1; }
}

.live-indicator {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	z-index: 1;
}

.live-dot {
	width: 10px;
	height: 10px;
	background: #ef4444;
	border-radius: 50%;
	animation: pulse 1.5s ease-in-out infinite;
	box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
}

@keyframes pulse {
	0%, 100% {
		transform: scale(1);
		opacity: 1;
	}
	50% {
		transform: scale(1.2);
		opacity: 0.7;
	}
}

.live-text {
	font-size: 0.75rem;
	font-weight: 700;
	color: #fca5a5;
	letter-spacing: 0.1em;
}

.match-content {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 1.5rem;
	z-index: 1;
	width: 100%;
}

.competitor {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	flex: 1;
	max-width: 150px;
}

.competitor-avatar {
	width: 48px;
	height: 48px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid rgba(255, 255, 255, 0.2);
}

.competitor-avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(139, 92, 246, 0.3);
	color: white;
	font-weight: 600;
	font-size: 1.25rem;
}

.competitor-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: white;
	text-align: center;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 100%;
}

.versus {
	display: flex;
	align-items: center;
	justify-content: center;
}

.vs-text {
	font-size: 0.875rem;
	font-weight: 700;
	color: rgba(255, 255, 255, 0.5);
}

.match-context {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
	z-index: 1;
}

.bracket-name {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
}

.round-name {
	font-size: 0.75rem;
	font-weight: 600;
	color: #fca5a5;
}

.watch-button {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.5rem;
	background: linear-gradient(135deg, #ef4444, #dc2626);
	color: white;
	font-size: 0.875rem;
	font-weight: 600;
	border-radius: 0.5rem;
	text-decoration: none;
	transition: all 0.2s;
	z-index: 1;
}

.watch-button:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

@media (min-width: 640px) {
	.live-banner {
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: space-between;
		padding: 1rem 1.5rem;
	}

	.match-content {
		flex: 1;
		justify-content: center;
	}

	.match-context {
		flex-direction: row;
		gap: 0.75rem;
	}

	.match-context span:first-child::after {
		content: "•";
		margin-left: 0.75rem;
		color: rgba(255, 255, 255, 0.3);
	}
}
</style>
