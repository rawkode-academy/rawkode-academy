<script setup lang="ts">
interface Competitor {
	id: string;
	name: string;
	displayName: string | null;
	imageUrl: string | null;
	seed: number | null;
}

defineProps<{
	competitor: Competitor | undefined;
	isWinner: boolean;
	isLoser: boolean;
	matchCompleted: boolean;
}>();

function getDisplayName(competitor: Competitor | undefined): string {
	if (!competitor) return "TBD";
	return competitor.displayName || competitor.name;
}
</script>

<template>
	<div
		:class="[
			'competitor-slot',
			{
				'is-winner': isWinner,
				'is-loser': isLoser,
				'is-tbd': !competitor,
			}
		]"
	>
		<div class="competitor-content">
			<div v-if="competitor?.seed" class="seed-badge">{{ competitor.seed }}</div>
			<img
				v-if="competitor?.imageUrl"
				:src="competitor.imageUrl"
				:alt="getDisplayName(competitor)"
				class="competitor-avatar"
			/>
			<div v-else class="avatar-placeholder">
				<svg v-if="competitor" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
				<svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<span class="competitor-name">{{ getDisplayName(competitor) }}</span>
		</div>

		<div v-if="isWinner" class="winner-indicator">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
	</div>
</template>

<style scoped>
.competitor-slot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5rem 0.75rem;
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0.375rem;
	transition: all 0.2s;
}

.competitor-slot.is-winner {
	background: rgba(34, 197, 94, 0.1);
	border-left: 2px solid #22c55e;
}

.competitor-slot.is-loser {
	opacity: 0.5;
}

.competitor-slot.is-tbd {
	opacity: 0.4;
}

.competitor-content {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	overflow: hidden;
}

.seed-badge {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 1.25rem;
	height: 1.25rem;
	padding: 0 0.25rem;
	background: rgba(139, 92, 246, 0.2);
	border-radius: 0.25rem;
	font-size: 0.625rem;
	font-weight: 700;
	color: #a78bfa;
}

.competitor-avatar {
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;
}

.avatar-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.3);
	flex-shrink: 0;
}

.competitor-name {
	font-size: 0.8125rem;
	font-weight: 500;
	color: white;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.is-tbd .competitor-name {
	color: rgba(255, 255, 255, 0.4);
	font-style: italic;
}

.winner-indicator {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.25rem;
	height: 1.25rem;
	border-radius: 50%;
	background: #22c55e;
	color: white;
	flex-shrink: 0;
}
</style>
