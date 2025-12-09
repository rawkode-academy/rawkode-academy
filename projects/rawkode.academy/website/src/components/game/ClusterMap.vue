<template>
	<div class="cluster-map">
		<header class="map-header">
			<h2>CLUSTER MAP</h2>
			<div class="header-right">
				<div class="progress">
					Breached: {{ defeatedEnemies.length }} / {{ totalEnemies }}
				</div>
				<nav class="map-nav">
					<button class="nav-btn" @click="$emit('viewInventory')">📦 Inventory</button>
					<button class="nav-btn" @click="$emit('viewAchievements')">🏆 Achievements</button>
					<button class="nav-btn" @click="$emit('viewLeaderboard')">📊 Leaderboard</button>
				</nav>
			</div>
		</header>

		<div class="layers-container">
			<div
				v-for="layer in layers"
				:key="layer.id"
				class="layer"
				:style="{ '--layer-color': layer.color }"
			>
				<div class="layer-header">
					<span class="layer-name">{{ layer.name }}</span>
					<span class="layer-status">
						{{ getLayerProgress(layer.id) }}
					</span>
				</div>

				<div class="layer-enemies">
					<button
						v-for="enemy in getLayerEnemies(layer.id)"
						:key="enemy.id"
						class="enemy-node"
						:class="{
							defeated: isDefeated(enemy.id),
							locked: isLocked(layer.id),
						}"
						:disabled="isDefeated(enemy.id) || isLocked(layer.id)"
						@click="selectEnemy(enemy)"
					>
						<div class="enemy-icon">
							<span v-if="isDefeated(enemy.id)" class="status-icon">✓</span>
							<span v-else-if="isLocked(layer.id)" class="status-icon">🔒</span>
							<img
								v-else
								:src="enemy.sprite"
								:alt="enemy.name"
								class="enemy-sprite-icon"
							/>
						</div>
						<div class="enemy-name">{{ enemy.name }}</div>
						<div class="enemy-difficulty">
							<span v-for="n in enemy.difficulty" :key="n">★</span>
						</div>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EnemyData, ClusterLayer } from "@/game/data/types";
import { enemies } from "@/game/data/enemies";

const props = defineProps<{
	defeatedEnemies: string[];
	devMode?: boolean;
}>();

const emit = defineEmits<{
	selectEnemy: [enemy: EnemyData];
	viewInventory: [];
	viewAchievements: [];
	viewLeaderboard: [];
}>();

const layers: { id: ClusterLayer; name: string; color: string }[] = [
	{ id: "External", name: "EXTERNAL", color: "#04b59c" },
	{ id: "App", name: "APP", color: "#3498db" },
	{ id: "ServiceMesh", name: "SERVICE MESH", color: "#9b59b6" },
	{ id: "KubeSystem", name: "KUBE-SYSTEM", color: "#e67e22" },
	{ id: "ApiServer", name: "API SERVER", color: "#e74c3c" },
	{ id: "Host", name: "HOST", color: "#c0392b" },
];

const totalEnemies = computed(() => enemies.length);

function getLayerEnemies(layerId: ClusterLayer): EnemyData[] {
	return enemies.filter((e) => e.layer === layerId);
}

function isDefeated(enemyId: string): boolean {
	return props.defeatedEnemies.includes(enemyId);
}

function isLocked(layerId: ClusterLayer): boolean {
	// Dev mode unlocks all enemies for testing
	if (props.devMode) return false;

	const layerIndex = layers.findIndex((l) => l.id === layerId);
	if (layerIndex === 0) return false;

	const previousLayer = layers[layerIndex - 1];
	if (!previousLayer) return true;

	const previousEnemies = getLayerEnemies(previousLayer.id);
	return !previousEnemies.every((e) => isDefeated(e.id));
}

function getLayerProgress(layerId: ClusterLayer): string {
	const layerEnemies = getLayerEnemies(layerId);
	const defeated = layerEnemies.filter((e) => isDefeated(e.id)).length;
	return `${defeated}/${layerEnemies.length}`;
}

function selectEnemy(enemy: EnemyData) {
	emit("selectEnemy", enemy);
}
</script>

<style scoped>
.cluster-map {
	width: 100%;
	min-height: calc(100vh - 200px);
	padding: 2rem;
	overflow-y: auto;
}

.map-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 2rem;
	padding-bottom: 1rem;
	border-bottom: 1px solid rgb(0 0 0 / 0.1);
	flex-wrap: wrap;
	gap: 1rem;
}

:root.dark .map-header {
	border-bottom-color: rgb(255 255 255 / 0.1);
}

.map-header h2 {
	color: rgb(var(--brand-primary));
	font-size: 1.5rem;
	letter-spacing: 0.2em;
}

.header-right {
	display: flex;
	align-items: center;
	gap: 1.5rem;
	flex-wrap: wrap;
}

.progress {
	color: rgb(107 114 128);
	font-size: 0.9rem;
}

:root.dark .progress {
	color: rgb(156 163 175);
}

.map-nav {
	display: flex;
	gap: 0.5rem;
}

.nav-btn {
	background: transparent;
	border: 1px solid rgb(var(--brand-primary) / 0.4);
	color: rgb(var(--brand-primary) / 0.8);
	padding: 0.4rem 0.75rem;
	font-family: inherit;
	font-size: 0.75rem;
	cursor: pointer;
	transition: all 0.2s ease;
	border-radius: 4px;
}

.nav-btn:hover {
	border-color: rgb(var(--brand-primary));
	color: rgb(var(--brand-primary));
	background: rgb(var(--brand-primary) / 0.1);
}

.layers-container {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.layer {
	background: rgb(0 0 0 / 0.03);
	border: 1px solid var(--layer-color);
	border-left: 4px solid var(--layer-color);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	transition: all 0.3s ease;
}

:root.dark .layer {
	background: rgb(255 255 255 / 0.03);
}

.layer:hover {
	background: rgb(0 0 0 / 0.05);
}

:root.dark .layer:hover {
	background: rgb(255 255 255 / 0.05);
}

.layer-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
}

.layer-name {
	color: var(--layer-color);
	font-weight: 600;
	font-size: 0.9rem;
	letter-spacing: 0.1em;
}

.layer-status {
	color: rgb(107 114 128);
	font-size: 0.8rem;
}

:root.dark .layer-status {
	color: rgb(156 163 175);
}

.layer-enemies {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
}

.enemy-node {
	background: rgb(255 255 255 / 0.5);
	border: 1px solid rgb(0 0 0 / 0.1);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	min-width: 160px;
	cursor: pointer;
	transition: all 0.3s ease;
	text-align: center;
	font-family: inherit;
	color: inherit;
}

:root.dark .enemy-node {
	background: rgb(0 0 0 / 0.3);
	border-color: rgb(255 255 255 / 0.1);
}

.enemy-node:not(:disabled):hover {
	border-color: var(--layer-color);
	background: rgb(255 255 255 / 0.7);
	transform: translateY(-2px);
}

:root.dark .enemy-node:not(:disabled):hover {
	background: rgb(255 255 255 / 0.05);
}

.enemy-node.defeated {
	opacity: 0.5;
	border-color: rgb(var(--brand-primary));
	background: rgb(var(--brand-primary) / 0.1);
}

.enemy-node.locked {
	opacity: 0.3;
	cursor: not-allowed;
}

.enemy-icon {
	font-size: 1.5rem;
	margin-bottom: 0.5rem;
	height: 48px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.enemy-sprite-icon {
	width: 48px;
	height: 48px;
	object-fit: contain;
	border-radius: 4px;
}

.status-icon {
	font-size: 2rem;
}

.enemy-name {
	color: rgb(17 24 39);
	font-size: 0.9rem;
	margin-bottom: 0.25rem;
}

:root.dark .enemy-name {
	color: white;
}

.enemy-difficulty {
	color: #d97706;
	font-size: 0.7rem;
	letter-spacing: 2px;
}

:root.dark .enemy-difficulty {
	color: #f1c40f;
}
</style>
