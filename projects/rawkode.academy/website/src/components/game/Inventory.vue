<template>
	<div class="inventory-container">
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
	External: "#04b59c",
	App: "#3498db",
	ServiceMesh: "#9b59b6",
	KubeSystem: "#e67e22",
	ApiServer: "#e74c3c",
	Host: "#c0392b",
	Generic: "#6b7280",
};

function getLayerColor(layer: InsultLayer): string {
	return layerColors[layer] || "#6b7280";
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

.tabs {
	display: flex;
	justify-content: center;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}

.tab {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(0 0 0 / 0.1);
	color: rgb(107 114 128);
	padding: 0.75rem 1.5rem;
	font-family: inherit;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.3s ease;
	backdrop-filter: blur(8px);
	border-radius: 4px;
}

:root.dark .tab {
	background: rgb(0 0 0 / 0.6);
	border-color: rgb(255 255 255 / 0.2);
	color: rgb(156 163 175);
}

.tab:hover {
	border-color: rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
}

.tab.active {
	border-color: rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	background: rgb(var(--brand-primary) / 0.1);
}

.items-container {
	background: rgb(255 255 255 / 0.8);
	border: 1px solid rgb(var(--brand-primary) / 0.3);
	border-radius: 12px;
	padding: 1rem;
	margin-bottom: 1.5rem;
	backdrop-filter: blur(8px);
	max-height: 50vh;
	overflow-y: auto;
}

:root.dark .items-container {
	background: rgb(0 0 0 / 0.6);
}

.items-list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.empty-state {
	color: rgb(107 114 128);
	font-style: italic;
	padding: 2rem;
}

:root.dark .empty-state {
	color: rgb(156 163 175);
}

.item-card {
	text-align: left;
	padding: 1rem;
	background: rgb(0 0 0 / 0.03);
	border-radius: 8px;
	border-left: 3px solid transparent;
	transition: all 0.2s ease;
}

:root.dark .item-card {
	background: rgb(255 255 255 / 0.05);
}

.item-card:hover {
	background: rgb(0 0 0 / 0.06);
}

:root.dark .item-card:hover {
	background: rgb(255 255 255 / 0.08);
}

.item-card.insult {
	border-left-color: #e67e22;
}

.item-card.comeback {
	border-left-color: rgb(var(--brand-primary));
}

.item-text {
	color: rgb(55 65 81);
	font-size: 0.95rem;
	line-height: 1.5;
	margin-bottom: 0.5rem;
}

:root.dark .item-text {
	color: rgb(204 204 204);
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
	color: rgb(107 114 128);
}

:root.dark .item-effective {
	color: rgb(156 163 175);
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
