<template>
	<div class="achievements-container">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">ACHIEVEMENTS</h2>
			<p class="subtitle">{{ unlockedCount }} / {{ achievements.length }} unlocked</p>

			<!-- Progress bar -->
			<div class="progress-bar">
				<div
					class="progress-fill"
					:style="{ width: `${(unlockedCount / achievements.length) * 100}%` }"
				></div>
			</div>

			<!-- Achievements grid -->
			<div class="achievements-grid">
				<div
					v-for="achievement in achievements"
					:key="achievement.id"
					class="achievement-card"
					:class="{ unlocked: achievement.unlockedAt }"
				>
					<div class="achievement-icon">
						{{ achievement.unlockedAt ? achievement.icon : '🔒' }}
					</div>
					<div class="achievement-info">
						<h3 class="achievement-name">{{ achievement.name }}</h3>
						<p class="achievement-description">{{ achievement.description }}</p>
						<p v-if="achievement.unlockedAt" class="achievement-date">
							Unlocked {{ formatDate(achievement.unlockedAt) }}
						</p>
					</div>
				</div>
			</div>

			<button class="back-btn" @click="$emit('close')">
				<span class="btn-text">[ BACK TO GAME ]</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PlayerAchievement } from "@/lib/game-api";

const props = defineProps<{
	achievements: PlayerAchievement[];
}>();

defineEmits<{
	close: [];
}>();

const unlockedCount = computed(() => {
	return props.achievements.filter((a) => a.unlockedAt !== null).length;
});

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
</script>

<style scoped>
.achievements-container {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	padding: 2rem;
}

.grid-bg {
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(rgb(var(--brand-primary) / 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgb(var(--brand-primary) / 0.1) 1px, transparent 1px);
	background-size: 40px 40px;
}

.content {
	text-align: center;
	z-index: 1;
	width: 100%;
	max-width: 800px;
}

.title {
	font-size: 2.5rem;
	font-weight: 700;
	color: rgb(var(--brand-primary));
	text-shadow: 0 0 20px rgb(var(--brand-primary) / 0.5);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: rgb(107 114 128);
	font-size: 1rem;
	margin-bottom: 1.5rem;
}

:root.dark .subtitle {
	color: rgb(156 163 175);
}

.progress-bar {
	width: 100%;
	height: 8px;
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(0 0 0 / 0.1);
	border-radius: 4px;
	overflow: hidden;
	margin-bottom: 2rem;
}

:root.dark .progress-bar {
	background: rgb(0 0 0 / 0.6);
	border-color: rgb(255 255 255 / 0.2);
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, rgb(var(--brand-primary)) 0%, rgb(var(--brand-secondary)) 100%);
	transition: width 0.5s ease;
}

.achievements-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 1rem;
	margin-bottom: 2rem;
}

.achievement-card {
	display: flex;
	gap: 1rem;
	padding: 1rem;
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(0 0 0 / 0.1);
	border-radius: 8px;
	text-align: left;
	transition: all 0.3s ease;
	backdrop-filter: blur(8px);
}

:root.dark .achievement-card {
	background: rgb(0 0 0 / 0.6);
	border-color: rgb(255 255 255 / 0.2);
}

.achievement-card.unlocked {
	border-color: rgb(var(--brand-primary) / 0.5);
	background: rgb(var(--brand-primary) / 0.05);
}

.achievement-card:not(.unlocked) {
	opacity: 0.6;
}

.achievement-icon {
	font-size: 2rem;
	width: 50px;
	height: 50px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgb(0 0 0 / 0.05);
	border-radius: 8px;
	flex-shrink: 0;
}

:root.dark .achievement-icon {
	background: rgb(255 255 255 / 0.05);
}

.achievement-card.unlocked .achievement-icon {
	background: rgb(var(--brand-primary) / 0.2);
}

.achievement-info {
	flex: 1;
	min-width: 0;
}

.achievement-name {
	font-size: 1rem;
	font-weight: 600;
	color: rgb(55 65 81);
	margin-bottom: 0.25rem;
}

:root.dark .achievement-name {
	color: rgb(204 204 204);
}

.achievement-card.unlocked .achievement-name {
	color: rgb(var(--brand-secondary));
}

.achievement-description {
	font-size: 0.85rem;
	color: rgb(107 114 128);
	line-height: 1.4;
}

:root.dark .achievement-description {
	color: rgb(156 163 175);
}

.achievement-date {
	font-size: 0.75rem;
	color: rgb(var(--brand-primary));
	margin-top: 0.5rem;
}

.back-btn {
	background: transparent;
	border: 2px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	padding: 1rem 2rem;
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.back-btn:hover {
	background: rgb(var(--brand-primary));
	color: white;
}

:root.dark .back-btn:hover {
	color: rgb(17 24 39);
}

.btn-text {
	animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
}
</style>
