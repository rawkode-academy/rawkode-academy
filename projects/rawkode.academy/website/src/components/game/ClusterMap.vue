<template>
	<div class="cluster-map">
		<header class="map-header">
			<h2>CLUSTER MAP</h2>
			<div class="progress">
				Breached: {{ defeatedEnemies.length }} / {{ totalEnemies }}
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
							<span v-if="isDefeated(enemy.id)">✓</span>
							<span v-else-if="isLocked(layer.id)">🔒</span>
							<span v-else>⚔</span>
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
}>();

const emit = defineEmits<{
	selectEnemy: [enemy: EnemyData];
}>();

const layers: { id: ClusterLayer; name: string; color: string }[] = [
	{ id: "external-web", name: "EXTERNAL WEB", color: "#04b59c" },
	{ id: "app-namespace", name: "APP NAMESPACE", color: "#3498db" },
	{ id: "service-mesh", name: "SERVICE MESH", color: "#9b59b6" },
	{ id: "control-plane", name: "CONTROL PLANE", color: "#e67e22" },
	{ id: "api-server", name: "API SERVER", color: "#e74c3c" },
	{ id: "host", name: "HOST", color: "#c0392b" },
];

const totalEnemies = computed(() => enemies.length);

function getLayerEnemies(layerId: ClusterLayer): EnemyData[] {
	return enemies.filter((e) => e.layer === layerId);
}

function isDefeated(enemyId: string): boolean {
	return props.defeatedEnemies.includes(enemyId);
}

function isLocked(layerId: ClusterLayer): boolean {
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
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.map-header h2 {
	color: #04b59c;
	font-size: 1.5rem;
	letter-spacing: 0.2em;
}

.progress {
	color: #888;
	font-size: 0.9rem;
}

.layers-container {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.layer {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--layer-color);
	border-left: 4px solid var(--layer-color);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	transition: all 0.3s ease;
}

.layer:hover {
	background: rgba(255, 255, 255, 0.05);
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
	color: #666;
	font-size: 0.8rem;
}

.layer-enemies {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
}

.enemy-node {
	background: rgba(0, 0, 0, 0.3);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	min-width: 160px;
	cursor: pointer;
	transition: all 0.3s ease;
	text-align: center;
	font-family: inherit;
	color: inherit;
}

.enemy-node:not(:disabled):hover {
	border-color: var(--layer-color);
	background: rgba(255, 255, 255, 0.05);
	transform: translateY(-2px);
}

.enemy-node.defeated {
	opacity: 0.5;
	border-color: #04b59c;
	background: rgba(4, 181, 156, 0.1);
}

.enemy-node.locked {
	opacity: 0.3;
	cursor: not-allowed;
}

.enemy-icon {
	font-size: 1.5rem;
	margin-bottom: 0.5rem;
}

.enemy-name {
	color: #fff;
	font-size: 0.9rem;
	margin-bottom: 0.25rem;
}

.enemy-difficulty {
	color: #f1c40f;
	font-size: 0.7rem;
	letter-spacing: 2px;
}
</style>
