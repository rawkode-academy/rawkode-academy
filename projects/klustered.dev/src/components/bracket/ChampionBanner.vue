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
	status: "draft" | "registration" | "active" | "completed";
	completedAt?: Date | null;
}

defineProps<{
	bracket: Bracket;
	champion: Competitor;
}>();

function getDisplayName(competitor: Competitor): string {
	return competitor.displayName || competitor.name;
}
</script>

<template>
	<div class="champion-banner">
		<div class="confetti-left"></div>
		<div class="confetti-right"></div>

		<div class="banner-content">
			<div class="trophy-icon">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" stroke="#fde047" />
					<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" stroke="#fde047" />
					<path d="M4 22h16" stroke="#fde047" />
					<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" stroke="#fde047" />
					<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" stroke="#fde047" />
					<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke="#fde047" fill="rgba(253, 224, 71, 0.2)" />
				</svg>
			</div>

			<div class="champion-info">
				<span class="label">{{ bracket.name }} Champion</span>
				<div class="champion-name-row">
					<img
						v-if="champion.imageUrl"
						:src="champion.imageUrl"
						:alt="getDisplayName(champion)"
						class="champion-avatar"
					/>
					<div v-else class="champion-avatar placeholder">
						{{ getDisplayName(champion).charAt(0).toUpperCase() }}
					</div>
					<h2 class="champion-name">{{ getDisplayName(champion) }}</h2>
				</div>
				<span class="bracket-type">{{ bracket.type === "solo" ? "Solo" : "Team" }} Competition</span>
			</div>

			<a :href="`/bracket/${bracket.slug}`" class="view-bracket-link">
				View Final Bracket
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</a>
		</div>
	</div>
</template>

<style scoped>
.champion-banner {
	position: relative;
	padding: 1.5rem 2rem;
	background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(234, 179, 8, 0.08));
	border: 1px solid rgba(251, 191, 36, 0.3);
	border-radius: 1rem;
	overflow: hidden;
}

.confetti-left,
.confetti-right {
	position: absolute;
	top: 0;
	width: 80px;
	height: 100%;
	background-image:
		radial-gradient(circle, #fde047 1px, transparent 1px),
		radial-gradient(circle, #a78bfa 1px, transparent 1px),
		radial-gradient(circle, #86efac 1px, transparent 1px);
	background-size: 12px 12px;
	background-position: 0 0, 6px 6px, 3px 3px;
	opacity: 0.4;
	pointer-events: none;
}

.confetti-left {
	left: 0;
	mask-image: linear-gradient(to right, black, transparent);
}

.confetti-right {
	right: 0;
	mask-image: linear-gradient(to left, black, transparent);
}

.banner-content {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	text-align: center;
}

@media (min-width: 640px) {
	.banner-content {
		flex-direction: row;
		text-align: left;
	}
}

.trophy-icon {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 80px;
	height: 80px;
	background: rgba(251, 191, 36, 0.1);
	border-radius: 50%;
	animation: gentle-bounce 3s ease-in-out infinite;
}

@keyframes gentle-bounce {
	0%, 100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-4px);
	}
}

.champion-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.label {
	font-size: 0.75rem;
	font-weight: 600;
	color: #fde047;
	text-transform: uppercase;
	letter-spacing: 0.1em;
}

.champion-name-row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	justify-content: center;
}

@media (min-width: 640px) {
	.champion-name-row {
		justify-content: flex-start;
	}
}

.champion-avatar {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid rgba(251, 191, 36, 0.5);
}

.champion-avatar.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(251, 191, 36, 0.2);
	color: #fde047;
	font-weight: 700;
	font-size: 1rem;
}

.champion-name {
	font-size: 1.5rem;
	font-weight: 700;
	color: white;
	margin: 0;
}

.bracket-type {
	font-size: 0.8125rem;
	color: rgba(255, 255, 255, 0.6);
}

.view-bracket-link {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.625rem 1rem;
	background: rgba(251, 191, 36, 0.15);
	border: 1px solid rgba(251, 191, 36, 0.4);
	border-radius: 0.5rem;
	color: #fde047;
	font-size: 0.8125rem;
	font-weight: 600;
	text-decoration: none;
	transition: all 0.2s;
	white-space: nowrap;
}

.view-bracket-link:hover {
	background: rgba(251, 191, 36, 0.25);
	color: white;
}
</style>
