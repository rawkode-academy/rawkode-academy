<template>
	<div class="game-container">
		<Transition name="fade" mode="out-in">
			<MenuScreen v-if="gameState === 'menu'" @start="startGame" />
			<ClusterMap
				v-else-if="gameState === 'map'"
				:defeated-enemies="defeatedEnemies"
				@select-enemy="startCombat"
			/>
			<CombatScreen
				v-else-if="gameState === 'combat' && currentEnemy"
				:enemy="currentEnemy"
				@victory="handleVictory"
				@defeat="handleDefeat"
			/>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { EnemyData } from "@/game/data/types";
import MenuScreen from "./MenuScreen.vue";
import ClusterMap from "./ClusterMap.vue";
import CombatScreen from "./CombatScreen.vue";

type GameState = "menu" | "map" | "combat";

const gameState = ref<GameState>("menu");
const currentEnemy = ref<EnemyData | null>(null);
const defeatedEnemies = ref<string[]>([]);

function startGame() {
	gameState.value = "map";
}

function startCombat(enemy: EnemyData) {
	currentEnemy.value = enemy;
	gameState.value = "combat";
}

function handleVictory() {
	if (currentEnemy.value) {
		defeatedEnemies.value.push(currentEnemy.value.id);
	}
	currentEnemy.value = null;
	gameState.value = "map";
}

function handleDefeat() {
	currentEnemy.value = null;
	gameState.value = "map";
}
</script>

<style scoped>
.game-container {
	width: 100%;
	min-height: calc(100vh - 200px);
	font-family: "JetBrains Mono", "Fira Code", monospace;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
