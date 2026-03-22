<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import TimezoneSelector from "./TimezoneSelector.vue";
import AddToCalendar from "./AddToCalendar.vue";
import {
	formatInTimezone,
	formatCountdown,
	isWithinHours,
	getUserTimezone,
} from "@/lib/timezone";

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
	status: "draft" | "registration" | "active" | "completed";
}

interface Match {
	id: string;
	bracketId: string;
	round: number;
	position: number;
	status: "pending" | "scheduled" | "live" | "completed";
	scheduledAt: Date | null;
	streamUrl: string | null;
	vodUrl: string | null;
	bracket: Bracket | null;
	competitor1: Competitor | null;
	competitor2: Competitor | null;
	winner: Competitor | null;
}

const props = defineProps<{
	matches: Match[];
	brackets: Bracket[];
}>();

const selectedTimezone = ref("UTC");
const selectedBracket = ref("all");
const selectedStatus = ref("all");

onMounted(() => {
	selectedTimezone.value = getUserTimezone();
});

function handleTimezoneChange(tz: string) {
	selectedTimezone.value = tz;
}

const filteredMatches = computed(() => {
	let result = [...props.matches];

	if (selectedBracket.value !== "all") {
		result = result.filter((m) => m.bracketId === selectedBracket.value);
	}

	if (selectedStatus.value !== "all") {
		if (selectedStatus.value === "upcoming") {
			result = result.filter(
				(m) => m.status === "scheduled" || m.status === "pending",
			);
		} else {
			result = result.filter((m) => m.status === selectedStatus.value);
		}
	}

	return result.sort((a, b) => {
		if (a.status === "live" && b.status !== "live") return -1;
		if (b.status === "live" && a.status !== "live") return 1;

		const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
		const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;

		if (a.status === "completed" && b.status === "completed") {
			return bTime - aTime;
		}

		return aTime - bTime;
	});
});

function getCompetitorName(competitor: Competitor | null): string {
	if (!competitor) return "TBD";
	return competitor.displayName || competitor.name;
}

function getRoundName(round: number, bracketId: string): string {
	const bracketMatches = props.matches.filter((m) => m.bracketId === bracketId);
	const totalRounds = bracketMatches.length > 0
		? Math.max(...bracketMatches.map((m) => m.round))
		: 4;

	const roundsFromEnd = totalRounds - round;
	if (roundsFromEnd === 0) return "Finals";
	if (roundsFromEnd === 1) return "Semi-Finals";
	if (roundsFromEnd === 2) return "Quarter-Finals";
	return `Round ${round}`;
}

function getMatchTitle(match: Match): string {
	const c1 = getCompetitorName(match.competitor1);
	const c2 = getCompetitorName(match.competitor2);
	return `${c1} vs ${c2} - ${match.bracket?.name || "Klustered"}`;
}

function getMatchDescription(match: Match): string {
	const roundName = getRoundName(match.round, match.bracketId);
	return `${roundName} - ${match.bracket?.name || "Klustered Competition"}`;
}

function isUpcomingSoon(date: Date | null): boolean {
	return isWithinHours(date, 24);
}

function getStatusClass(status: string): string {
	switch (status) {
		case "live":
			return "status-live";
		case "completed":
			return "status-completed";
		case "scheduled":
			return "status-scheduled";
		default:
			return "status-pending";
	}
}

function getStatusText(status: string): string {
	switch (status) {
		case "live":
			return "LIVE";
		case "completed":
			return "Completed";
		case "scheduled":
			return "Scheduled";
		default:
			return "Upcoming";
	}
}

function getBracketStatusLabel(status: string): string {
	switch (status) {
		case "draft":
			return "Coming Soon";
		case "registration":
			return "Registration Open";
		case "active":
			return "In Progress";
		case "completed":
			return "Completed";
		default:
			return status;
	}
}

const hasAnyMatches = computed(() => props.matches.length > 0);
const isFilteredEmpty = computed(
	() => hasAnyMatches.value && filteredMatches.value.length === 0,
);
</script>

<template>
	<div class="schedule-list">
		<div class="filters">
			<div class="filter-group">
				<label class="filter-label">Timezone</label>
				<TimezoneSelector @change="handleTimezoneChange" />
			</div>

			<div class="filter-group">
				<label for="bracket-filter" class="filter-label">Bracket</label>
				<select
					id="bracket-filter"
					v-model="selectedBracket"
					class="filter-select"
				>
					<option value="all">All Brackets</option>
					<option
						v-for="bracket in brackets"
						:key="bracket.id"
						:value="bracket.id"
					>
						{{ bracket.name }}
					</option>
				</select>
			</div>

			<div class="filter-group">
				<label for="status-filter" class="filter-label">Status</label>
				<select
					id="status-filter"
					v-model="selectedStatus"
					class="filter-select"
				>
					<option value="all">All Matches</option>
					<option value="live">Live Now</option>
					<option value="upcoming">Upcoming</option>
					<option value="completed">Completed</option>
				</select>
			</div>
		</div>

		<div v-if="filteredMatches.length === 0" class="empty-state">
			<div v-if="isFilteredEmpty" class="empty-filtered">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
				</svg>
				<p>No matches found with the selected filters.</p>
				<button class="reset-filters-btn" @click="selectedBracket = 'all'; selectedStatus = 'all'">
					Reset Filters
				</button>
			</div>
			<div v-else class="empty-no-matches">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-icon-large">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<h3 class="empty-title">Schedule Coming Soon</h3>
				<p class="empty-description">
					Matches will appear here once the bracket is generated and competitors are confirmed.
				</p>
				<div v-if="brackets.length > 0" class="bracket-preview">
					<p class="bracket-preview-label">Competition brackets:</p>
					<div class="bracket-tags">
						<span
							v-for="bracket in brackets"
							:key="bracket.id"
							:class="['bracket-tag', `bracket-tag--${bracket.status}`]"
						>
							{{ bracket.name }} - {{ getBracketStatusLabel(bracket.status) }}
						</span>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="matches">
			<div
				v-for="match in filteredMatches"
				:key="match.id"
				:class="[
					'match-row',
					{ 'is-live': match.status === 'live' },
					{ 'is-soon': isUpcomingSoon(match.scheduledAt) && match.status !== 'completed' },
				]"
			>
				<div class="match-time-col">
					<div v-if="match.scheduledAt" class="time-info">
						<span class="time-formatted">
							{{ formatInTimezone(match.scheduledAt, selectedTimezone) }}
						</span>
						<span
							v-if="match.status !== 'completed'"
							class="time-countdown"
						>
							{{ formatCountdown(match.scheduledAt) }}
						</span>
					</div>
					<span v-else class="time-tbd">Time TBD</span>
				</div>

				<div class="match-info-col">
					<div class="bracket-badge">
						{{ match.bracket?.name }}
						<span class="round-name">{{ getRoundName(match.round, match.bracketId) }}</span>
					</div>

					<div class="matchup">
						<div class="competitor">
							<img
								v-if="match.competitor1?.imageUrl"
								:src="match.competitor1.imageUrl"
								:alt="getCompetitorName(match.competitor1)"
								class="avatar"
							/>
							<div v-else class="avatar placeholder">
								{{ getCompetitorName(match.competitor1).charAt(0).toUpperCase() }}
							</div>
							<span
								:class="[
									'name',
									{ 'is-winner': match.winner?.id === match.competitor1?.id },
									{ 'is-loser': match.winner && match.winner.id !== match.competitor1?.id },
								]"
							>
								{{ getCompetitorName(match.competitor1) }}
							</span>
						</div>

						<span class="vs">vs</span>

						<div class="competitor">
							<img
								v-if="match.competitor2?.imageUrl"
								:src="match.competitor2.imageUrl"
								:alt="getCompetitorName(match.competitor2)"
								class="avatar"
							/>
							<div v-else class="avatar placeholder">
								{{ getCompetitorName(match.competitor2).charAt(0).toUpperCase() }}
							</div>
							<span
								:class="[
									'name',
									{ 'is-winner': match.winner?.id === match.competitor2?.id },
									{ 'is-loser': match.winner && match.winner.id !== match.competitor2?.id },
								]"
							>
								{{ getCompetitorName(match.competitor2) }}
							</span>
						</div>
					</div>
				</div>

				<div class="match-status-col">
					<span :class="['status-badge', getStatusClass(match.status)]">
						{{ getStatusText(match.status) }}
					</span>
				</div>

				<div class="match-actions-col">
					<a
						v-if="match.streamUrl && match.status === 'live'"
						:href="match.streamUrl"
						target="_blank"
						rel="noopener"
						class="action-btn stream-btn"
						title="Watch Live"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
							<path d="M8 5v14l11-7z"/>
						</svg>
					</a>

					<a
						v-if="match.vodUrl && match.status === 'completed'"
						:href="match.vodUrl"
						target="_blank"
						rel="noopener"
						class="action-btn vod-btn"
						title="Watch VOD"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</a>

					<AddToCalendar
						v-if="match.scheduledAt && match.status !== 'completed'"
						:title="getMatchTitle(match)"
						:description="getMatchDescription(match)"
						:startDate="match.scheduledAt"
						:url="match.streamUrl ?? undefined"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.schedule-list {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.filters {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	padding: 1rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
}

.filter-group {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.filter-label {
	font-size: 0.6875rem;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.5);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.filter-select {
	appearance: none;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5rem;
	padding: 0.5rem 2rem 0.5rem 0.75rem;
	color: white;
	font-size: 0.8125rem;
	cursor: pointer;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpath d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 0.5rem center;
	min-width: 140px;
}

.filter-select:hover {
	border-color: rgba(139, 92, 246, 0.4);
}

.filter-select:focus {
	outline: none;
	border-color: rgba(139, 92, 246, 0.6);
}

.filter-select option {
	background: #1a1a2e;
}

.empty-state {
	padding: 3rem;
	text-align: center;
	color: rgba(255, 255, 255, 0.5);
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0.75rem;
}

.empty-filtered,
.empty-no-matches {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
}

.empty-icon {
	color: rgba(255, 255, 255, 0.4);
	margin-bottom: 0.25rem;
}

.empty-icon-large {
	color: rgba(139, 92, 246, 0.5);
	margin-bottom: 0.5rem;
}

.empty-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: white;
	margin: 0;
}

.empty-description {
	color: rgba(255, 255, 255, 0.6);
	max-width: 400px;
	margin: 0;
}

.reset-filters-btn {
	margin-top: 0.5rem;
	padding: 0.5rem 1rem;
	background: rgba(139, 92, 246, 0.15);
	border: 1px solid rgba(139, 92, 246, 0.3);
	border-radius: 0.5rem;
	color: #c4b5fd;
	font-size: 0.8125rem;
	cursor: pointer;
	transition: all 0.2s;
}

.reset-filters-btn:hover {
	background: rgba(139, 92, 246, 0.25);
	border-color: rgba(139, 92, 246, 0.5);
	color: white;
}

.bracket-preview {
	margin-top: 1rem;
	padding-top: 1rem;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.bracket-preview-label {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.5);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin: 0 0 0.75rem 0;
}

.bracket-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.5rem;
}

.bracket-tag {
	font-size: 0.75rem;
	padding: 0.375rem 0.75rem;
	border-radius: 9999px;
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.7);
}

.bracket-tag--draft {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.5);
}

.bracket-tag--registration {
	background: rgba(34, 197, 94, 0.15);
	color: #86efac;
}

.bracket-tag--active {
	background: rgba(251, 191, 36, 0.15);
	color: #fcd34d;
}

.bracket-tag--completed {
	background: rgba(139, 92, 246, 0.15);
	color: #c4b5fd;
}

.matches {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.match-row {
	display: grid;
	grid-template-columns: 1fr;
	gap: 0.75rem;
	padding: 1rem;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
	transition: all 0.2s;
}

@media (min-width: 768px) {
	.match-row {
		grid-template-columns: 180px 1fr auto auto;
		align-items: center;
	}
}

.match-row:hover {
	border-color: rgba(139, 92, 246, 0.3);
}

.match-row.is-live {
	border-color: rgba(239, 68, 68, 0.4);
	background: rgba(239, 68, 68, 0.05);
}

.match-row.is-soon {
	border-color: rgba(251, 191, 36, 0.3);
	background: rgba(251, 191, 36, 0.03);
}

.match-time-col {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
}

.time-info {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
}

.time-formatted {
	font-size: 0.8125rem;
	color: white;
	font-weight: 500;
}

.time-countdown {
	font-size: 0.6875rem;
	color: #a78bfa;
	font-weight: 600;
}

.time-tbd {
	font-size: 0.8125rem;
	color: rgba(255, 255, 255, 0.5);
	font-style: italic;
}

.match-info-col {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.bracket-badge {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.6875rem;
	color: rgba(255, 255, 255, 0.6);
}

.round-name {
	color: #a5b4fc;
}

.matchup {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	flex-wrap: wrap;
}

.competitor {
	display: flex;
	align-items: center;
	gap: 0.375rem;
}

.avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	object-fit: cover;
}

.avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(139, 92, 246, 0.3);
	color: white;
	font-weight: 600;
	font-size: 0.625rem;
}

.name {
	font-size: 0.875rem;
	font-weight: 500;
	color: white;
}

.name.is-winner {
	color: #86efac;
}

.name.is-loser {
	opacity: 0.5;
}

.vs {
	font-size: 0.625rem;
	color: rgba(255, 255, 255, 0.4);
	text-transform: uppercase;
}

.match-status-col {
	display: flex;
	align-items: center;
}

.status-badge {
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	padding: 0.25rem 0.5rem;
	border-radius: 9999px;
}

.status-pending {
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.5);
}

.status-scheduled {
	background: rgba(99, 102, 241, 0.2);
	color: #a5b4fc;
}

.status-live {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	animation: pulse 2s infinite;
}

.status-completed {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.6;
	}
}

.match-actions-col {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	border-radius: 0.375rem;
	transition: all 0.2s;
}

.stream-btn {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.3);
	color: #fca5a5;
}

.stream-btn:hover {
	background: rgba(239, 68, 68, 0.25);
	color: white;
}

.vod-btn {
	background: rgba(139, 92, 246, 0.15);
	border: 1px solid rgba(139, 92, 246, 0.3);
	color: #c4b5fd;
}

.vod-btn:hover {
	background: rgba(139, 92, 246, 0.25);
	color: white;
}
</style>
