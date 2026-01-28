<script setup lang="ts">
interface Match {
	id: string;
	scheduledAt: Date | null;
}

interface BracketWithCounts {
	id: string;
	name: string;
	slug: string;
	type: "solo" | "team";
	status: "draft" | "registration" | "active" | "completed";
	competitorCount: number;
	totalRounds: number;
	currentRound: number;
	remainingCompetitors: number;
	nextMatch: Match | null;
}

const props = defineProps<{
	bracket: BracketWithCounts;
}>();

function getRoundName(round: number, totalRounds: number): string {
	const roundsFromEnd = totalRounds - round;
	if (roundsFromEnd === 0) return "Finals";
	if (roundsFromEnd === 1) return "Semi-Finals";
	if (roundsFromEnd === 2) return "Quarter-Finals";
	return `Round ${round}`;
}

function getStatusBadgeClass(): string {
	switch (props.bracket.status) {
		case "registration":
			return "badge-registration";
		case "active":
			return "badge-active";
		case "completed":
			return "badge-completed";
		default:
			return "badge-draft";
	}
}

function getStatusText(): string {
	switch (props.bracket.status) {
		case "registration":
			return "Registration Open";
		case "active":
			return "In Progress";
		case "completed":
			return "Completed";
		default:
			return "Draft";
	}
}

function formatDate(date: Date | null): string {
	if (!date) return "";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function getProgress(): number {
	if (props.bracket.totalRounds === 0) return 0;
	return ((props.bracket.currentRound - 1) / props.bracket.totalRounds) * 100;
}
</script>

<template>
	<div class="bracket-card">
		<div class="card-header">
			<div class="header-left">
				<h3 class="bracket-name">{{ bracket.name }}</h3>
				<span :class="['type-badge', `type-${bracket.type}`]">
					{{ bracket.type === "solo" ? "Solo" : "Team" }}
				</span>
			</div>
			<span :class="['status-badge', getStatusBadgeClass()]">
				{{ getStatusText() }}
			</span>
		</div>

		<div v-if="bracket.status === 'active'" class="progress-section">
			<div class="progress-info">
				<span class="current-round">{{ getRoundName(bracket.currentRound, bracket.totalRounds) }}</span>
				<span class="competitors-remaining">{{ bracket.remainingCompetitors }} remaining</span>
			</div>
			<div class="progress-bar">
				<div class="progress-fill" :style="{ width: `${getProgress()}%` }"></div>
			</div>
		</div>

		<div v-else-if="bracket.status === 'registration'" class="registration-info">
			<div class="stat">
				<span class="stat-value">{{ bracket.competitorCount }}</span>
				<span class="stat-label">Confirmed Competitors</span>
			</div>
		</div>

		<div v-else-if="bracket.status === 'completed'" class="completed-info">
			<span class="completed-text">Competition Complete</span>
		</div>

		<div v-if="bracket.nextMatch?.scheduledAt" class="next-match">
			<span class="next-label">Next match:</span>
			<span class="next-time">{{ formatDate(bracket.nextMatch.scheduledAt) }}</span>
		</div>

		<a :href="`/bracket/${bracket.slug}`" class="view-link">
			View Bracket
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</a>
	</div>
</template>

<style scoped>
.bracket-card {
	background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05));
	border: 1px solid rgba(99, 102, 241, 0.2);
	border-radius: 1rem;
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
	transition: all 0.2s;
}

.bracket-card:hover {
	border-color: rgba(139, 92, 246, 0.4);
	transform: translateY(-2px);
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 0.75rem;
	flex-wrap: wrap;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.bracket-name {
	font-size: 1.125rem;
	font-weight: 600;
	color: white;
	margin: 0;
}

.type-badge {
	font-size: 0.625rem;
	font-weight: 600;
	padding: 0.2rem 0.5rem;
	border-radius: 9999px;
	text-transform: uppercase;
}

.type-solo {
	background: rgba(99, 102, 241, 0.2);
	color: #a5b4fc;
}

.type-team {
	background: rgba(168, 85, 247, 0.2);
	color: #d8b4fe;
}

.status-badge {
	font-size: 0.625rem;
	font-weight: 600;
	padding: 0.25rem 0.5rem;
	border-radius: 9999px;
	text-transform: uppercase;
}

.badge-registration {
	background: rgba(251, 191, 36, 0.2);
	color: #fde047;
}

.badge-active {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

.badge-completed {
	background: rgba(99, 102, 241, 0.2);
	color: #a5b4fc;
}

.badge-draft {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.5);
}

.progress-section {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.progress-info {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.current-round {
	font-size: 0.875rem;
	font-weight: 600;
	color: #a5b4fc;
}

.competitors-remaining {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
}

.progress-bar {
	height: 4px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 2px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #6366f1, #8b5cf6);
	border-radius: 2px;
	transition: width 0.3s ease;
}

.registration-info {
	display: flex;
	justify-content: center;
}

.stat {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
}

.stat-value {
	font-size: 1.5rem;
	font-weight: 700;
	color: white;
}

.stat-label {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.6);
}

.completed-info {
	text-align: center;
}

.completed-text {
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.6);
}

.next-match {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border-radius: 0.5rem;
}

.next-label {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.5);
}

.next-time {
	font-size: 0.75rem;
	font-weight: 600;
	color: #a5b4fc;
}

.view-link {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.5rem 1rem;
	background: rgba(139, 92, 246, 0.2);
	color: #c4b5fd;
	font-size: 0.875rem;
	font-weight: 500;
	border-radius: 0.5rem;
	text-decoration: none;
	transition: all 0.2s;
}

.view-link:hover {
	background: rgba(139, 92, 246, 0.3);
	color: white;
}
</style>
