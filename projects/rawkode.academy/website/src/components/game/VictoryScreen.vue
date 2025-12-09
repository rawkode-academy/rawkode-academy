<template>
	<div class="victory-screen">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">CLUSTER BREACHED</h2>
			<p class="subtitle">{{ enemyName }} has been defeated!</p>

			<!-- Stats -->
			<div class="stats">
				<div class="stat">
					<span class="stat-value">{{ moveCount }}</span>
					<span class="stat-label">MOVES</span>
				</div>
				<div class="stat">
					<span class="stat-value">{{ formatTime(timeSeconds) }}</span>
					<span class="stat-label">TIME</span>
				</div>
				<div v-if="rank" class="stat">
					<span class="stat-value rank">{{ formatRank(rank) }}</span>
					<span class="stat-label">RANK</span>
				</div>
			</div>

			<!-- Share card section -->
			<div class="share-section">
				<h3 class="share-title">SHARE YOUR VICTORY</h3>

				<div v-if="isGeneratingCard" class="generating">
					<div class="loading-spinner"></div>
					<p>Generating share card...</p>
				</div>

				<div v-else-if="shareCard" class="share-card-container">
					<img :src="shareCard.imageUrl" alt="Victory Share Card" class="share-card-preview" />

					<div class="share-buttons">
						<button class="share-btn twitter" @click="shareToTwitter">
							Share on X
						</button>
						<button class="share-btn copy" @click="copyShareLink">
							{{ copied ? 'Copied!' : 'Copy Link' }}
						</button>
					</div>
				</div>

				<button v-else-if="!shareError" class="generate-btn" @click="generateShareCard">
					[ GENERATE SHARE CARD ]
				</button>

				<p v-if="shareError" class="share-error">{{ shareError }}</p>
			</div>

			<!-- Actions -->
			<div class="actions">
				<button class="action-btn primary" @click="$emit('continue')">
					<span class="btn-text">[ CONTINUE ]</span>
				</button>
				<button class="action-btn secondary" @click="$emit('viewLeaderboard')">
					[ LEADERBOARD ]
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { generateShareCard as apiGenerateShareCard, type ShareCardResult } from "@/lib/game-api";

const props = defineProps<{
	enemyId: string;
	enemyName: string;
	moveCount: number;
	timeSeconds: number;
	rank?: string;
}>();

defineEmits<{
	continue: [];
	viewLeaderboard: [];
}>();

const isGeneratingCard = ref(false);
const shareCard = ref<ShareCardResult | null>(null);
const shareError = ref<string | null>(null);
const copied = ref(false);

const RANK_NAMES: Record<string, string> = {
	SCRIPT_KIDDIE: "Script Kiddie",
	PENTESTER: "Pentester",
	RED_TEAMER: "Red Teamer",
	SECURITY_RESEARCHER: "Security Researcher",
	CISO_SLAYER: "CISO Slayer",
};

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins > 0) {
		return `${mins}m ${secs}s`;
	}
	return `${secs}s`;
}

function formatRank(rank: string): string {
	return RANK_NAMES[rank] || rank;
}

async function generateShareCard() {
	isGeneratingCard.value = true;
	shareError.value = null;

	try {
		const result = await apiGenerateShareCard({
			enemyDefeated: props.enemyId,
			moveCount: props.moveCount,
			timeSeconds: props.timeSeconds,
			rank: props.rank,
		});

		shareCard.value = result;
	} catch (error) {
		console.error("Failed to generate share card:", error);
		shareError.value = "Failed to generate share card. Please try again.";
	} finally {
		isGeneratingCard.value = false;
	}
}

function shareToTwitter() {
	if (!shareCard.value) return;

	const text = encodeURIComponent(shareCard.value.shareText);
	const url = `https://twitter.com/intent/tweet?text=${text}`;
	window.open(url, "_blank", "noopener,noreferrer");
}

async function copyShareLink() {
	if (!shareCard.value) return;

	try {
		await navigator.clipboard.writeText(shareCard.value.shareUrl);
		copied.value = true;
		setTimeout(() => {
			copied.value = false;
		}, 2000);
	} catch (error) {
		console.error("Failed to copy to clipboard:", error);
	}
}
</script>

<style scoped>
.victory-screen {
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
		linear-gradient(rgb(var(--brand-secondary) / 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgb(var(--brand-secondary) / 0.1) 1px, transparent 1px);
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
	color: rgb(var(--brand-secondary));
	text-shadow:
		0 0 20px rgb(var(--brand-secondary) / 0.5),
		0 0 40px rgb(var(--brand-secondary) / 0.3);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
	animation: victory-glow 2s ease-in-out infinite;
}

@keyframes victory-glow {
	0%, 100% {
		text-shadow:
			0 0 20px rgb(var(--brand-secondary) / 0.5),
			0 0 40px rgb(var(--brand-secondary) / 0.3);
	}
	50% {
		text-shadow:
			0 0 30px rgb(var(--brand-secondary) / 0.8),
			0 0 60px rgb(var(--brand-secondary) / 0.5);
	}
}

.subtitle {
	color: rgb(107 114 128);
	font-size: 1.2rem;
	margin-bottom: 2rem;
}

:root.dark .subtitle {
	color: rgb(204 204 204);
}

.stats {
	display: flex;
	justify-content: center;
	gap: 2rem;
	margin-bottom: 2rem;
}

.stat {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(var(--brand-secondary) / 0.3);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	text-align: center;
	backdrop-filter: blur(8px);
}

:root.dark .stat {
	background: rgb(0 0 0 / 0.6);
}

.stat-value {
	display: block;
	font-size: 1.5rem;
	font-weight: 700;
	color: rgb(var(--brand-secondary));
}

.stat-value.rank {
	font-size: 1rem;
}

.stat-label {
	display: block;
	font-size: 0.75rem;
	color: rgb(107 114 128);
	letter-spacing: 0.1em;
	margin-top: 0.25rem;
}

:root.dark .stat-label {
	color: rgb(156 163 175);
}

.share-section {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(var(--brand-primary) / 0.3);
	border-radius: 12px;
	padding: 1.5rem;
	margin-bottom: 2rem;
	backdrop-filter: blur(8px);
}

:root.dark .share-section {
	background: rgb(0 0 0 / 0.6);
}

.share-title {
	color: rgb(var(--brand-primary));
	font-size: 0.9rem;
	letter-spacing: 0.2em;
	margin-bottom: 1rem;
}

.generating {
	padding: 1rem;
	color: rgb(107 114 128);
}

:root.dark .generating {
	color: rgb(156 163 175);
}

.loading-spinner {
	width: 30px;
	height: 30px;
	border: 2px solid rgb(var(--brand-primary) / 0.2);
	border-top-color: rgb(var(--brand-primary));
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin: 0 auto 0.5rem;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.share-card-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
}

.share-card-preview {
	max-width: 100%;
	height: auto;
	border-radius: 8px;
	border: 1px solid rgb(0 0 0 / 0.1);
}

:root.dark .share-card-preview {
	border-color: rgb(255 255 255 / 0.2);
}

.share-buttons {
	display: flex;
	gap: 0.75rem;
}

.share-btn {
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
	border-radius: 4px;
}

.share-btn.twitter {
	background: #1da1f2;
	border: none;
	color: white;
}

.share-btn.twitter:hover {
	background: #1a91da;
}

.share-btn.copy {
	background: transparent;
	border: 1px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
}

.share-btn.copy:hover {
	background: rgb(var(--brand-primary) / 0.1);
}

.generate-btn {
	background: transparent;
	border: 1px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
}

.generate-btn:hover {
	background: rgb(var(--brand-primary) / 0.1);
}

.share-error {
	color: #e74c3c;
	font-size: 0.9rem;
	margin-top: 0.5rem;
}

.actions {
	display: flex;
	justify-content: center;
	gap: 1rem;
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
	border: 2px solid rgb(var(--brand-secondary));
	color: rgb(var(--brand-secondary));
}

.action-btn.primary:hover {
	background: rgb(var(--brand-secondary));
	color: white;
}

:root.dark .action-btn.primary:hover {
	color: rgb(17 24 39);
}

.action-btn.secondary {
	border: 1px solid rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
}

.action-btn.secondary:hover {
	background: rgb(var(--brand-primary) / 0.1);
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
