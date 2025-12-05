<template>
	<div class="game-container">
		<Transition name="fade" mode="out-in">
			<MenuScreen v-if="gameState === 'menu'" @start="handleStart" />
			<InitialAllocationScreen
				v-else-if="gameState === 'allocation'"
				@continue="handleAllocationComplete"
			/>
			<ClusterMap
				v-else-if="gameState === 'map'"
				:defeated-enemies="defeatedEnemies"
				@select-enemy="startCombat"
			/>
			<CombatScreen
				v-else-if="gameState === 'combat' && currentEnemy"
				:enemy="currentEnemy"
				:learned-insults="learnedInsults"
				:learned-comebacks="learnedComebacks"
				@victory="handleVictory"
				@defeat="handleDefeat"
				@learn-insult="handleLearnInsult"
				@learn-comeback="handleLearnComeback"
			/>
		</Transition>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { EnemyData, Insult, Comeback } from "@/game/data/types";
import MenuScreen from "./MenuScreen.vue";
import InitialAllocationScreen from "./InitialAllocationScreen.vue";
import ClusterMap from "./ClusterMap.vue";
import CombatScreen from "./CombatScreen.vue";

type GameState = "menu" | "allocation" | "map" | "combat";

const gameState = ref<GameState>("menu");
const currentEnemy = ref<EnemyData | null>(null);
const defeatedEnemies = ref<string[]>([]);
const learnedInsults = ref<Insult[]>([]);
const learnedComebacks = ref<Comeback[]>([]);
const isNewPlayer = ref(true);

function handleStart() {
	if (isNewPlayer.value) {
		gameState.value = "allocation";
	} else {
		gameState.value = "map";
	}
}

function handleAllocationComplete(insults: Insult[], comebacks: Comeback[]) {
	learnedInsults.value = insults;
	learnedComebacks.value = comebacks;
	isNewPlayer.value = false;
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

function handleLearnInsult(insult: Insult) {
	if (!learnedInsults.value.some((i) => i.id === insult.id)) {
		learnedInsults.value.push(insult);
	}
}

function handleLearnComeback(comeback: Comeback) {
	if (!learnedComebacks.value.some((c) => c.id === comeback.id)) {
		learnedComebacks.value.push(comeback);
	}
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
