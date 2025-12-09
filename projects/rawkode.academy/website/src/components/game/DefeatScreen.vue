<template>
	<div class="defeat-screen">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">BREACH FAILED</h2>
			<p class="subtitle">{{ enemyName }} has repelled your attack!</p>

			<!-- Learned phrases section -->
			<div v-if="learnedInsults.length > 0 || learnedComebacks.length > 0" class="learned-section">
				<h3 class="learned-title">INTELLIGENCE GATHERED</h3>
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
		linear-gradient(rgb(231 76 60 / 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgb(231 76 60 / 0.1) 1px, transparent 1px);
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
	color: #e74c3c;
	text-shadow:
		0 0 20px rgb(231 76 60 / 0.5),
		0 0 40px rgb(231 76 60 / 0.3);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: rgb(107 114 128);
	font-size: 1.2rem;
	margin-bottom: 2rem;
}

:root.dark .subtitle {
	color: rgb(204 204 204);
}

.learned-section {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(var(--brand-primary) / 0.3);
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	text-align: left;
}

:root.dark .learned-section {
	background: rgb(0 0 0 / 0.6);
}

.learned-title {
	color: rgb(var(--brand-primary));
	font-size: 1rem;
	letter-spacing: 0.15em;
	margin-bottom: 0.5rem;
	text-align: center;
}

.learned-subtitle {
	color: rgb(107 114 128);
	font-size: 0.9rem;
	margin-bottom: 1rem;
	text-align: center;
}

:root.dark .learned-subtitle {
	color: rgb(156 163 175);
}

.phrase-group {
	margin-bottom: 1rem;
}

.phrase-group:last-child {
	margin-bottom: 0;
}

.phrase-type {
	color: rgb(var(--brand-secondary));
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
	background: rgb(0 0 0 / 0.05);
	border-radius: 6px;
	margin-bottom: 0.5rem;
	font-size: 0.95rem;
	color: rgb(55 65 81);
	border-left: 3px solid transparent;
}

:root.dark .phrase-item {
	background: rgb(255 255 255 / 0.05);
	color: rgb(204 204 204);
}

.phrase-item:last-child {
	margin-bottom: 0;
}

.phrase-item.insult {
	border-left-color: #e67e22;
}

.phrase-item.comeback {
	border-left-color: rgb(var(--brand-primary));
}

.no-learned {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(0 0 0 / 0.1);
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	color: rgb(107 114 128);
}

:root.dark .no-learned {
	background: rgb(0 0 0 / 0.6);
	border-color: rgb(255 255 255 / 0.1);
	color: rgb(156 163 175);
}

.encouragement {
	color: rgb(var(--brand-primary));
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
	border: 2px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
}

.action-btn.primary:hover {
	background: rgb(var(--brand-primary));
	color: white;
}

:root.dark .action-btn.primary:hover {
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
