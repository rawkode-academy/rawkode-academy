<template>
	<div :class="gameTheme.root" class="inventory-container">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">INVENTORY</h2>
			<p class="subtitle">Your arsenal of wit</p>

			<div class="tabs">
				<button
					class="tab"
					:class="{ active: activeTab === 'insults' }"
					@click="activeTab = 'insults'"
				>
					⚔️ Insults ({{ insults.length }})
				</button>
				<button
					class="tab"
					:class="{ active: activeTab === 'comebacks' }"
					@click="activeTab = 'comebacks'"
				>
					🛡️ Comebacks ({{ comebacks.length }})
				</button>
			</div>

			<div class="items-container">
				<!-- Insults tab -->
				<div v-if="activeTab === 'insults'" class="items-list">
					<div v-if="insults.length === 0" class="empty-state">
						No insults learned yet. Battle enemies to learn their tactics!
					</div>
					<div
						v-for="insult in insults"
						:key="insult.id"
						class="item-card insult"
					>
						<div class="item-text">"{{ insult.text }}"</div>
						<div class="item-meta">
							<span class="item-layer" :style="{ color: getLayerColor(insult.layer) }">
								{{ insult.layer }}
							</span>
							<span v-if="insult.enemies.length > 0" class="item-effective">
								Effective vs: {{ insult.enemies.length }} enemies
							</span>
						</div>
					</div>
				</div>

				<!-- Comebacks tab -->
				<div v-if="activeTab === 'comebacks'" class="items-list">
					<div v-if="comebacks.length === 0" class="empty-state">
						No comebacks learned yet. Watch how enemies respond to learn!
					</div>
					<div
						v-for="comeback in comebacks"
						:key="comeback.id"
						class="item-card comeback"
					>
						<div class="item-text">"{{ comeback.text }}"</div>
						<div class="item-meta">
							<span class="item-layer" :style="{ color: getLayerColor(comeback.layer) }">
								{{ comeback.layer }}
							</span>
							<span v-if="comeback.effectiveness.length > 0" class="item-effective">
								Counters: {{ comeback.effectiveness.length }} insults
							</span>
						</div>
					</div>
				</div>
			</div>

			<button class="back-btn" @click="$emit('close')">
				<span class="btn-text">[ BACK ]</span>
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
import { ref } from "vue";
import type { Insult, Comeback, InsultLayer } from "@/game/data/types";

defineProps<{
	insults: Insult[];
	comebacks: Comeback[];
}>();

defineEmits<{
	close: [];
}>();

const activeTab = ref<"insults" | "comebacks">("insults");

const layerColors: Record<InsultLayer, string> = {
	External: "var(--colors-academy-status-spruce)",
	App: "var(--colors-academy-status-sky)",
	ServiceMesh: "var(--colors-academy-status-violet)",
	KubeSystem: "var(--colors-academy-status-amber)",
	ApiServer: "var(--colors-academy-status-rust)",
	Host: "var(--colors-academy-status-rust)",
	Generic: "var(--colors-academy-text-muted)",
};

function getLayerColor(layer: InsultLayer): string {
	return layerColors[layer] || "var(--colors-academy-text-muted)";
}
</script>

<style scoped>
.inventory-container {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	align-items: flex-start;
	justify-content: center;
	position: relative;
	overflow: hidden;
	padding: 2rem;
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
}

.title {
	font-size: 2.5rem;
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

.tabs {
	display: flex;
	justify-content: center;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}

.tab {
	background: var(--colors-academy-panel);
	border: 1px solid var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
	backdrop-filter: blur(8px);
	border-radius: 4px;
}

:root.dark .tab {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
	color: var(--colors-academy-text-muted);
}

.tab:hover {
	border-color: var(--colors-academy-accent);
	color: var(--colors-academy-accent);
}

.tab.active {
	border-color: var(--colors-academy-accent);
	color: var(--colors-academy-accent);
	background: color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent);
}

.items-container {
	background: var(--colors-academy-panel);
	border: 1px solid color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
	border-radius: 12px;
	padding: 1rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	max-height: 50vh;
	overflow-y: auto;
}

:root.dark .items-container {
	background: var(--colors-academy-panel);
}

.items-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.empty-state {
	color: var(--colors-academy-text-muted);
	font-style: italic;
	padding: 2rem;
}

:root.dark .empty-state {
	color: var(--colors-academy-text-muted);
}

.item-card {
	text-align: left;
	padding: 1rem;
	background: var(--colors-academy-border);
	border-radius: 8px;
	border-left: 3px solid transparent;
	transition: all 0.2s ease;
}

:root.dark .item-card {
	background: var(--colors-academy-border);
}

.item-card:hover {
	background: var(--colors-academy-border);
}

:root.dark .item-card:hover {
	background: var(--colors-academy-border);
}

.item-card.insult {
	border-left-color: var(--colors-academy-status-amber);
}

.item-card.comeback {
	border-left-color: var(--colors-academy-accent);
}

.item-text {
	color: var(--colors-academy-text);
	font-size: 0.95rem;
	line-height: 1.5;
	margin-bottom: 0.5rem;
}

:root.dark .item-text {
	color: var(--colors-academy-text-muted);
}

.item-meta {
	display: flex;
	gap: 1rem;
	font-size: 0.75rem;
}

.item-layer {
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.item-effective {
	color: var(--colors-academy-text-muted);
}

:root.dark .item-effective {
	color: var(--colors-academy-text-muted);
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
