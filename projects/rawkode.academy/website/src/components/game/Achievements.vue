<template>
	<div :class="gameTheme.root" class="achievements-container">
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
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
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
	padding: clamp(1rem, 4vw, 2rem);
}

.grid-bg {
	position: absolute;
	inset: 0;
	background-image:
		linear-gradient(color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px),
		linear-gradient(90deg, color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px);
	background-size: 40px 40px;
}

.content {
	text-align: center;
	z-index: 1;
	width: 100%;
	max-width: 800px;
	min-width: 0;
}

.title {
	font-size: clamp(1.5rem, 6vw, 2.5rem);
	font-weight: 700;
	color: var(--colors-academy-accent);
	text-shadow: 0 0 20px color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: var(--colors-academy-text-muted);
	font-size: 1rem;
	margin-bottom: 1.5rem;
}

:root.dark .subtitle {
	color: var(--colors-academy-text-muted);
}

.progress-bar {
	width: 100%;
	height: 8px;
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-border);
	border-radius: 4px;
	overflow: hidden;
	margin-bottom: 2rem;
}

:root.dark .progress-bar {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--colors-academy-accent) 0%, var(--colors-academy-status-violet) 100%);
	transition: width 0.5s ease;
}

.achievements-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	gap: 1rem;
	margin-bottom: 2rem;
}

.achievement-card {
	display: flex;
	min-width: 0;
	gap: 1rem;
	padding: 1rem;
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-border);
	border-radius: 8px;
	text-align: left;
	transition: all 0.3s ease;
	backdrop-filter: blur(8px);
}

:root.dark .achievement-card {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
}

.achievement-card.unlocked {
	border-color: color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent);
	background: color-mix(in srgb, var(--colors-academy-accent) 5.0%, transparent);
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
	background: var(--colors-academy-border);
	border-radius: 8px;
	flex-shrink: 0;
}

:root.dark .achievement-icon {
	background: var(--colors-academy-border);
}

.achievement-card.unlocked .achievement-icon {
	background: color-mix(in srgb, var(--colors-academy-accent) 20.0%, transparent);
}

.achievement-info {
	flex: 1;
	min-width: 0;
	overflow-wrap: anywhere;
}

.achievement-name {
	font-size: 1rem;
	font-weight: 600;
	color: var(--colors-academy-text);
	margin-bottom: 0.25rem;
}

:root.dark .achievement-name {
	color: var(--colors-academy-text-muted);
}

.achievement-card.unlocked .achievement-name {
	color: var(--colors-academy-status-violet);
}

.achievement-description {
	font-size: 0.85rem;
	color: var(--colors-academy-text-muted);
	line-height: 1.4;
}

:root.dark .achievement-description {
	color: var(--colors-academy-text-muted);
}

.achievement-date {
	font-size: 0.75rem;
	color: var(--colors-academy-accent);
	margin-top: 0.5rem;
}

.back-btn {
	background: transparent;
	border: 2px solid var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	padding: 1rem 2rem;
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.back-btn:hover {
	background: var(--colors-academy-accent);
	color: white;
}

:root.dark .back-btn:hover {
	color: var(--colors-academy-text);
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
