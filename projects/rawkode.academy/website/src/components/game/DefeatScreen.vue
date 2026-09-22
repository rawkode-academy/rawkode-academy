<template>
	<div :class="gameTheme.root" class="defeat-screen">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">BREACH FAILED</h2>
			<p class="subtitle">{{ enemyName }} has repelled your attack!</p>

			<!-- Learned phrases section -->
			<div v-if="learnedInsults.length > 0 || learnedComebacks.length > 0" class="learned-section">
				<h3 class="learned-title">WHAT YOU LEARNED</h3>
				<p class="learned-subtitle">You learned from the enemy's tactics:</p>

				<div v-if="learnedInsults.length > 0" class="phrase-group">
					<h4 class="phrase-type">New Insults</h4>
					<ul class="phrase-list">
						<li v-for="insult in learnedInsults" :key="insult.id" class="phrase-item insult">
							"{{ insult.text }}"
						</li>
					</ul>
				</div>

				<div v-if="learnedComebacks.length > 0" class="phrase-group">
					<h4 class="phrase-type">New Comebacks</h4>
					<ul class="phrase-list">
						<li v-for="comeback in learnedComebacks" :key="comeback.id" class="phrase-item comeback">
							"{{ comeback.text }}"
						</li>
					</ul>
				</div>
			</div>

			<div v-else class="no-learned">
				<p>No new phrases learned this round.</p>
			</div>

			<!-- Encouragement -->
			<p class="encouragement">Use these against your enemies next time!</p>

			<!-- Actions -->
			<div class="actions">
				<button class="action-btn primary" @click="$emit('continue')">
					<span class="btn-text">[ TRY AGAIN ]</span>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
import type { Insult, Comeback } from "@/game/data/types";

defineProps<{
	enemyName: string;
	learnedInsults: Insult[];
	learnedComebacks: Comeback[];
}>();

defineEmits<{
	continue: [];
}>();
</script>

<style scoped>
.defeat-screen {
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
		linear-gradient(color-mix(in srgb, var(--colors-academy-status-rust) 10.0%, transparent) 1px, transparent 1px),
		linear-gradient(90deg, color-mix(in srgb, var(--colors-academy-status-rust) 10.0%, transparent) 1px, transparent 1px);
	background-size: 40px 40px;
	animation: grid-pulse 2s ease-in-out infinite;
}

@keyframes grid-pulse {
	0%, 100% {
		opacity: 0.5;
	}
	50% {
		opacity: 1;
	}
}

.content {
	text-align: center;
	z-index: 1;
	width: 100%;
	max-width: 600px;
}

.title {
	font-size: 3rem;
	font-weight: 700;
	color: var(--colors-academy-status-rust);
	text-shadow:
		0 0 20px color-mix(in srgb, var(--colors-academy-status-rust) 50.0%, transparent),
		0 0 40px color-mix(in srgb, var(--colors-academy-status-rust) 30.0%, transparent);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: var(--colors-academy-text-muted);
	font-size: 1.2rem;
	margin-bottom: 2rem;
}

:root.dark .subtitle {
	color: var(--colors-academy-text-muted);
}

.learned-section {
	background: var(--colors-academy-panel);
	border: 1px solid color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	text-align: left;
}

:root.dark .learned-section {
	background: var(--colors-academy-panel);
}

.learned-title {
	color: var(--colors-academy-accent);
	font-size: 1rem;
	letter-spacing: 0.15em;
	margin-bottom: 0.5rem;
	text-align: center;
}

.learned-subtitle {
	color: var(--colors-academy-text-muted);
	font-size: 0.9rem;
	margin-bottom: 1rem;
	text-align: center;
}

:root.dark .learned-subtitle {
	color: var(--colors-academy-text-muted);
}

.phrase-group {
	margin-bottom: 1rem;
}

.phrase-group:last-child {
	margin-bottom: 0;
}

.phrase-type {
	color: var(--colors-academy-status-violet);
	font-size: 0.85rem;
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
	text-transform: uppercase;
}

.phrase-list {
	list-style: none;
	padding: 0;
	margin: 0;
}

.phrase-item {
	padding: 0.75rem 1rem;
	background: var(--colors-academy-border);
	border-radius: 6px;
	margin-bottom: 0.5rem;
	font-size: 0.95rem;
	color: var(--colors-academy-text);
	border-left: 3px solid transparent;
}

:root.dark .phrase-item {
	background: var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
}

.phrase-item:last-child {
	margin-bottom: 0;
}

.phrase-item.insult {
	border-left-color: var(--colors-academy-status-amber);
}

.phrase-item.comeback {
	border-left-color: var(--colors-academy-accent);
}

.no-learned {
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-border);
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	color: var(--colors-academy-text-muted);
}

:root.dark .no-learned {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
}

.encouragement {
	color: var(--colors-academy-accent);
	font-size: 1rem;
	margin-bottom: 2rem;
	font-style: italic;
}

.actions {
	display: flex;
	justify-content: center;
}

.action-btn {
	background: transparent;
	padding: 1rem 2rem;
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.action-btn.primary {
	border: 2px solid var(--colors-academy-accent);
	color: var(--colors-academy-accent);
}

.action-btn.primary:hover {
	background: var(--colors-academy-accent);
	color: white;
}

:root.dark .action-btn.primary:hover {
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
