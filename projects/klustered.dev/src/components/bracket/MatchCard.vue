<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import CompetitorSlot from "./CompetitorSlot.vue";
import {
	formatInTimezone,
	formatCountdown,
	getCountdown,
	getUserTimezone,
	isWithinHours,
} from "@/lib/timezone";

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
	scheduledAt: Date | null;
	streamUrl: string | null;
	vodUrl: string | null;
}

const props = defineProps<{
	match: Match;
	competitor1: Competitor | undefined;
	competitor2: Competitor | undefined;
	winner: Competitor | undefined;
}>();

const timezone = ref("UTC");
const countdownText = ref("");
let countdownInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
	timezone.value = getUserTimezone();
	updateCountdown();
	if (props.match.scheduledAt && props.match.status !== "completed") {
		countdownInterval = setInterval(updateCountdown, 1000);
	}
});

onUnmounted(() => {
	if (countdownInterval) {
		clearInterval(countdownInterval);
	}
});

function updateCountdown() {
	if (!props.match.scheduledAt) {
		countdownText.value = "";
		return;
	}
	countdownText.value = formatCountdown(props.match.scheduledAt);
}

const formattedTime = computed(() => {
	if (!props.match.scheduledAt) return null;
	return formatInTimezone(props.match.scheduledAt, timezone.value, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
});

const isUpcomingSoon = computed(() => {
	return isWithinHours(props.match.scheduledAt, 2);
});

const liveElapsed = computed(() => {
	if (props.match.status !== "live" || !props.match.scheduledAt) return null;
	const countdown = getCountdown(props.match.scheduledAt);
	if (!countdown || !countdown.isPast) return null;
	const { hours, minutes } = countdown;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
});

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
</script>

<template>
	<div :class="['match-card', { 'is-live': match.status === 'live' }, { 'is-soon': isUpcomingSoon && match.status !== 'live' && match.status !== 'completed' }]">
		<div class="match-header">
			<div class="status-row">
				<span :class="['status-indicator', getStatusClass(match.status)]">
					{{ getStatusText(match.status) }}
				</span>
				<span v-if="match.status === 'live' && liveElapsed" class="live-elapsed">
					{{ liveElapsed }}
				</span>
				<span
					v-else-if="countdownText && match.status !== 'completed'"
					:class="['countdown', { 'is-soon': isUpcomingSoon }]"
				>
					{{ countdownText }}
				</span>
			</div>
			<div class="match-links">
				<a
					v-if="match.streamUrl && match.status === 'live'"
					:href="match.streamUrl"
					target="_blank"
					rel="noopener"
					class="match-link stream-link"
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
					class="match-link vod-link"
					title="Watch VOD"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</a>
			</div>
		</div>

		<div v-if="formattedTime && match.status !== 'completed'" class="match-time">
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</svg>
			<span>{{ formattedTime }}</span>
		</div>

		<div class="competitors">
			<CompetitorSlot
				:competitor="competitor1"
				:isWinner="match.winnerId === match.competitor1Id"
				:isLoser="match.winnerId !== null && match.winnerId !== match.competitor1Id"
				:matchCompleted="match.status === 'completed'"
			/>

			<div class="versus-divider">
				<span class="versus-text">vs</span>
			</div>

			<CompetitorSlot
				:competitor="competitor2"
				:isWinner="match.winnerId === match.competitor2Id"
				:isLoser="match.winnerId !== null && match.winnerId !== match.competitor2Id"
				:matchCompleted="match.status === 'completed'"
			/>
		</div>
	</div>
</template>

<style scoped>
.match-card {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75rem;
	padding: 0.75rem;
	transition: all 0.2s;
}

.match-card:hover {
	border-color: rgba(139, 92, 246, 0.3);
}

.match-card.is-live {
	border-color: rgba(239, 68, 68, 0.4);
	box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
}

.match-card.is-soon {
	border-color: rgba(251, 191, 36, 0.3);
}

.match-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.5rem;
}

.status-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.live-elapsed {
	font-size: 0.6rem;
	color: #fca5a5;
	font-weight: 500;
}

.countdown {
	font-size: 0.6rem;
	color: rgba(255, 255, 255, 0.5);
	font-weight: 500;
}

.countdown.is-soon {
	color: #fde047;
}

.match-time {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.375rem 0.5rem;
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0.375rem;
	margin-bottom: 0.5rem;
	font-size: 0.625rem;
	color: rgba(255, 255, 255, 0.6);
}

.status-indicator {
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	padding: 0.125rem 0.5rem;
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

.match-links {
	display: flex;
	gap: 0.5rem;
}

.match-link {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 0.25rem;
	transition: all 0.2s;
}

.stream-link {
	color: #ef4444;
	background: rgba(239, 68, 68, 0.1);
}

.stream-link:hover {
	background: rgba(239, 68, 68, 0.2);
}

.vod-link {
	color: #a78bfa;
	background: rgba(139, 92, 246, 0.1);
}

.vod-link:hover {
	background: rgba(139, 92, 246, 0.2);
}

.competitors {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.versus-divider {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.125rem 0;
}

.versus-text {
	font-size: 0.625rem;
	color: rgba(255, 255, 255, 0.3);
	text-transform: uppercase;
}
</style>
