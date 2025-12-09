<template>
	<div class="combat-screen">
		<div class="combat-header">
			<div class="player-status">
				<span class="status-label">{{ playerName }}</span>
				<div class="health-bar">
					<span v-for="n in 3" :key="n" class="heart" :class="{ empty: n > playerHealth }">
						{{ n <= playerHealth ? "❤️" : "🖤" }}
					</span>
				</div>
			</div>

			<div class="vs">VS</div>

			<div class="enemy-status">
				<span class="status-label">{{ enemy.name }}</span>
				<div class="health-bar">
					<span v-for="n in 3" :key="n" class="heart" :class="{ empty: n > enemyHealth }">
						{{ n <= enemyHealth ? "❤️" : "🖤" }}
					</span>
				</div>
			</div>
		</div>

		<div
			class="combat-arena"
			:style="{ backgroundImage: `url(${sceneBackground})` }"
		>
			<div class="combatant player" :class="{ hit: playerHit, attacking: playerAttacking }">
				<img :src="playerSprite" alt="Player" class="combatant-sprite" />
			</div>

			<Transition name="result">
				<div v-if="showResult" class="result-display" :class="resultType">
					{{ resultMessage }}
				</div>
			</Transition>

			<div class="combatant enemy" :class="{ hit: enemyHit, attacking: enemyAttacking }">
				<img :src="enemy.sprite" :alt="enemy.name" class="combatant-sprite" />
			</div>
		</div>

		<div class="dialogue-box">
			<!-- Turn indicator -->
			<div class="turn-indicator" v-if="!isProcessing && !showResult">
				<span v-if="attacker === 'player'" class="your-turn">YOUR TURN TO INSULT</span>
				<span v-else class="enemy-turn">{{ enemy.name }} INSULTS:</span>
			</div>

			<!-- Current phrase being spoken -->
			<div class="phrase-text" :class="attacker === 'player' ? 'player-phrase' : 'enemy-phrase'" v-if="currentPhrase && !showResult">
				"{{ currentPhrase }}"
			</div>

			<!-- Player picking an insult (player's turn to attack) -->
			<div class="choices" v-if="!isProcessing && phase === 'player-pick-insult'">
				<button class="choice-btn flee-choice" @click="flee">
					<span class="flee-key">Ctrl+D</span>
					Run away!
				</button>
				<button
					v-for="(insult, index) in availableInsults"
					:key="insult.id"
					class="choice-btn"
					@click="playerInsult(insult)"
				>
					<span class="choice-number">{{ index + 1 }}.</span>
					{{ insult.text }}
				</button>
			</div>

			<!-- Player picking a comeback (enemy's turn, player responds) -->
			<div class="choices" v-if="!isProcessing && phase === 'player-pick-comeback'">
				<button
					v-for="(comeback, index) in availableComebacks"
					:key="comeback.id"
					class="choice-btn"
					@click="playerComeback(comeback)"
				>
					<span class="choice-number">{{ index + 1 }}.</span>
					{{ comeback.text }}
				</button>
			</div>

			<!-- Response display -->
			<div v-if="responsePhrase" class="response-text">
				"{{ responsePhrase }}"
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { EnemyData, Insult, Comeback, InsultLayer } from "@/game/data/types";
import { insults, comebacks, getEffectiveComebacks } from "@/game/data/insults";
import { layerScenes } from "@/game/data/scenes";
import { sfx } from "@/game/sound";

// Layer hierarchy - enemies know their layer and all previous layers
const layerOrder: InsultLayer[] = ["External", "App", "ServiceMesh", "KubeSystem", "ApiServer", "Host"];

function getAccessibleLayers(enemyLayer: InsultLayer): InsultLayer[] {
	const index = layerOrder.indexOf(enemyLayer);
	if (index === -1) return ["Generic"];
	return [...layerOrder.slice(0, index + 1), "Generic"];
}

const props = defineProps<{
	enemy: EnemyData;
	playerName: string;
	learnedInsults: Insult[];
	learnedComebacks: Comeback[];
}>();

const emit = defineEmits<{
	victory: [moveCount: number];
	defeat: [];
	flee: [];
	learnInsult: [insult: Insult];
	learnComeback: [comeback: Comeback];
}>();

type Phase = 'player-pick-insult' | 'player-pick-comeback' | 'enemy-responding' | 'processing';
type Attacker = 'player' | 'enemy';

const playerHealth = ref(3);
const enemyHealth = ref(3);
const attacker = ref<Attacker>('player');
const phase = ref<Phase>('player-pick-insult');
const currentPhrase = ref<string | null>(null);
const responsePhrase = ref<string | null>(null);
const currentInsultId = ref<string | null>(null);
const availableInsults = ref<Insult[]>([]);
const availableComebacks = ref<Comeback[]>([]);
const isProcessing = ref(false);
const showResult = ref(false);
const resultMessage = ref("");
const resultType = ref<"success" | "failure">("success");
const moveCount = ref(0);
const usedEnemyInsults = ref<Set<string>>(new Set());
const usedPlayerInsults = ref<Set<string>>(new Set());

const playerHit = ref(false);
const enemyHit = ref(false);
const playerAttacking = ref(false);
const enemyAttacking = ref(false);

const sceneBackground = computed(() => layerScenes[props.enemy.layer]);
const playerSprite = "/games/secret-of-kubernetes-island/player.webp";

function flee() {
	emit("flee");
}

onMounted(() => {
	startCombat();
});

function startCombat() {
	// Randomly decide who starts
	attacker.value = Math.random() < 0.5 ? 'player' : 'enemy';
	startTurn();
}

function startTurn() {
	isProcessing.value = false;
	responsePhrase.value = null;
	currentPhrase.value = null;

	if (attacker.value === 'player') {
		// Player's turn to insult
		availableInsults.value = getRandomInsults();
		phase.value = 'player-pick-insult';
	} else {
		// Enemy's turn to insult
		enemyInsult();
	}
}

function getRandomInsults(): Insult[] {
	const learned = props.learnedInsults;

	// Find insults effective against current enemy
	const effectiveInsults = learned.filter((i) =>
		i.enemies.includes(props.enemy.id) || i.layer === props.enemy.layer
	);

	// Filter out already-used insults this combat
	const unusedEffective = effectiveInsults.filter((i) =>
		!usedPlayerInsults.value.has(i.id)
	);
	const unusedNonEffective = learned.filter((i) =>
		!effectiveInsults.some((e) => e.id === i.id) &&
		!usedPlayerInsults.value.has(i.id)
	);

	if (learned.length <= 4) {
		return [...learned].sort(() => Math.random() - 0.5);
	}

	const choices: Insult[] = [];

	// Guarantee 1 effective if available and unused
	if (unusedEffective.length > 0) {
		const shuffledEffective = [...unusedEffective].sort(() => Math.random() - 0.5);
		choices.push(shuffledEffective[0]!);

		// Fill rest with random non-effective (prefer unused)
		const shuffledNonEffective = [...unusedNonEffective].sort(() => Math.random() - 0.5);
		for (const insult of shuffledNonEffective) {
			if (choices.length >= 4) break;
			choices.push(insult);
		}

		// If still need more, add remaining effective
		for (const insult of shuffledEffective.slice(1)) {
			if (choices.length >= 4) break;
			choices.push(insult);
		}
	} else {
		// No unused effective - random from unused (or all if all used)
		const allUnused = learned.filter((i) => !usedPlayerInsults.value.has(i.id));
		const pool = allUnused.length > 0 ? allUnused : learned;
		const shuffled = [...pool].sort(() => Math.random() - 0.5);
		choices.push(...shuffled.slice(0, 4));
	}

	return choices.sort(() => Math.random() - 0.5);
}

function getRandomComebacks(insultId: string): Comeback[] {
	const learned = props.learnedComebacks;
	const effectiveComebacks = getEffectiveComebacks(insultId);

	const learnedEffective = learned.filter((c) =>
		effectiveComebacks.some((e) => e.id === c.id)
	);
	const learnedNonEffective = learned.filter((c) =>
		!effectiveComebacks.some((e) => e.id === c.id)
	);

	const choices: Comeback[] = [];

	if (learned.length > 4) {
		if (learnedEffective.length > 0) {
			const shuffledEffective = [...learnedEffective].sort(() => Math.random() - 0.5);
			choices.push(shuffledEffective[0]!);

			const shuffledNonEffective = [...learnedNonEffective].sort(() => Math.random() - 0.5);
			for (const c of shuffledNonEffective) {
				if (choices.length >= 4) break;
				choices.push(c);
			}
		} else {
			const shuffled = [...learned].sort(() => Math.random() - 0.5);
			choices.push(...shuffled.slice(0, 4));
		}
	} else {
		choices.push(...learned);
	}

	return choices.sort(() => Math.random() - 0.5);
}

function playerInsult(insult: Insult) {
	if (isProcessing.value) return;

	moveCount.value++;
	usedPlayerInsults.value.add(insult.id);
	isProcessing.value = true;
	currentPhrase.value = insult.text;
	currentInsultId.value = insult.id;
	phase.value = 'enemy-responding';

	sfx.playerAttack();
	playerAttacking.value = true;

	setTimeout(() => {
		playerAttacking.value = false;
		// Enemy responds with a comeback
		enemyRespond(insult.id);
	}, 500);
}

function enemyRespond(insultId: string) {
	// Enemy knows comebacks from their layer and all previous layers
	const accessibleLayers = getAccessibleLayers(props.enemy.layer);
	const knownComebacks = comebacks.filter((c) => accessibleLayers.includes(c.layer));

	const effectiveComebacks = getEffectiveComebacks(insultId);
	// Only consider effective comebacks the enemy actually knows
	const knownEffective = effectiveComebacks.filter((c) => knownComebacks.some((k) => k.id === c.id));

	// Enemy chance scales with progression - earlier layers are forgiving, later layers challenge
	const layerChance: Record<string, number> = {
		External: 0.2,    // Very forgiving - player is learning
		App: 0.35,
		ServiceMesh: 0.5,
		KubeSystem: 0.65,
		ApiServer: 0.8,
		Host: 0.9,        // Boss tier - nearly always blocks (player needs effective insults)
	};
	const chance = layerChance[props.enemy.layer] ?? 0.4;
	const knowsEffective = knownEffective.length > 0 && Math.random() < chance;

	let chosenComeback: Comeback;
	if (knowsEffective) {
		chosenComeback = knownEffective[Math.floor(Math.random() * knownEffective.length)]!;
	} else {
		// Pick a random comeback from what the enemy knows
		const randomComebacks = knownComebacks.filter((c) => !knownEffective.some((e) => e.id === c.id));
		chosenComeback = randomComebacks[Math.floor(Math.random() * randomComebacks.length)] || knownComebacks[0] || comebacks[0]!;
	}

	// Player learns this comeback by seeing the enemy use it
	learnComeback(chosenComeback);

	responsePhrase.value = chosenComeback.text;

	const isEffective = effectiveComebacks.some((e) => e.id === chosenComeback.id);

	setTimeout(() => {
		resolveExchange(isEffective, 'enemy');
	}, 1000);
}

function enemyInsult() {
	// Enemy knows insults from their layer and all previous layers
	const accessibleLayers = getAccessibleLayers(props.enemy.layer);
	const allAvailable = insults.filter((i) => accessibleLayers.includes(i.layer));
	// Filter out insults already used this combat
	let available = allAvailable.filter((i) => !usedEnemyInsults.value.has(i.id));

	// If all insults have been used, reset and allow repeats
	if (available.length === 0) {
		usedEnemyInsults.value.clear();
		available = allAvailable;
	}

	const insult = available[Math.floor(Math.random() * available.length)] || insults[0]!;
	usedEnemyInsults.value.add(insult.id);

	// Player learns this insult by seeing the enemy use it
	learnInsult(insult);

	currentPhrase.value = insult.text;
	currentInsultId.value = insult.id;

	sfx.enemyAttack();
	enemyAttacking.value = true;

	setTimeout(() => {
		enemyAttacking.value = false;
		// Player needs to respond
		availableComebacks.value = getRandomComebacks(insult.id);
		phase.value = 'player-pick-comeback';
		isProcessing.value = false;
	}, 500);
}

function playerComeback(comeback: Comeback) {
	if (isProcessing.value || !currentInsultId.value) return;

	moveCount.value++;
	isProcessing.value = true;
	responsePhrase.value = comeback.text;

	const effectiveComebacks = getEffectiveComebacks(currentInsultId.value);
	const isEffective = effectiveComebacks.some((e) => e.id === comeback.id);

	setTimeout(() => {
		resolveExchange(isEffective, 'player');
	}, 500);
}

function resolveExchange(responderWon: boolean, responder: Attacker) {
	phase.value = 'processing';

	if (responderWon) {
		// Responder's comeback was effective - attacker takes damage
		if (responder === 'player') {
			sfx.effectiveHit();
			enemyHit.value = true;
			enemyHealth.value--;
			resultMessage.value = "EFFECTIVE!";
			resultType.value = "success";
		} else {
			sfx.ineffectiveHit();
			playerHit.value = true;
			playerHealth.value--;
			resultMessage.value = "BLOCKED!";
			resultType.value = "failure";
		}
	} else {
		// Responder's comeback was ineffective - responder takes damage
		if (responder === 'player') {
			sfx.ineffectiveHit();
			playerHit.value = true;
			playerHealth.value--;
			resultMessage.value = "INEFFECTIVE...";
			resultType.value = "failure";
		} else {
			sfx.effectiveHit();
			enemyHit.value = true;
			enemyHealth.value--;
			resultMessage.value = "PATHETIC!";
			resultType.value = "success";
		}
	}

	showResult.value = true;

	setTimeout(() => {
		playerHit.value = false;
		enemyHit.value = false;
	}, 300);

	setTimeout(() => {
		showResult.value = false;

		if (enemyHealth.value <= 0) {
			sfx.victory();
			emit("victory", moveCount.value);
		} else if (playerHealth.value <= 0) {
			sfx.defeat();
			emit("defeat");
		} else {
			// Snake style: responder becomes the next attacker
			attacker.value = responder;
			startTurn();
		}
	}, 1500);
}

function learnInsult(insult: Insult) {
	if (!props.learnedInsults.some((i) => i.id === insult.id)) {
		emit("learnInsult", insult);
	}
}

function learnComeback(comeback: Comeback) {
	if (!props.learnedComebacks.some((c) => c.id === comeback.id)) {
		emit("learnComeback", comeback);
	}
}
</script>

<style scoped>
.combat-screen {
	width: 100%;
	min-height: calc(100vh - 200px);
	display: flex;
	flex-direction: column;
	padding: 2rem;
}

.combat-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 2rem;
}

.player-status,
.enemy-status {
	text-align: center;
}

.status-label {
	display: block;
	font-size: 1rem;
	margin-bottom: 0.5rem;
	letter-spacing: 0.1em;
}

.player-status .status-label {
	color: rgb(var(--brand-primary));
}

.enemy-status .status-label {
	color: #e74c3c;
}

.health-bar {
	font-size: 1.5rem;
	letter-spacing: 4px;
}

.vs {
	color: rgb(107 114 128);
	font-size: 1.5rem;
	font-weight: bold;
}

:root.dark .vs {
	color: rgb(156 163 175);
}

.combat-arena {
	display: flex;
	justify-content: space-around;
	align-items: flex-end;
	position: relative;
	padding: 2rem 2rem 0 2rem;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	border-radius: 12px;
	margin: 1rem 0;
	min-height: 300px;
	aspect-ratio: 16 / 9;
	max-height: 50vh;
}

.combat-arena::before {
	content: "";
	position: absolute;
	inset: 0;
	background: rgba(255, 255, 255, 0.15);
	border-radius: 12px;
	pointer-events: none;
	z-index: 1;
}

:root.dark .combat-arena::before {
	background: rgba(0, 0, 0, 0.15);
}

.combatant {
	transition: transform 0.2s ease;
	position: relative;
	z-index: 2;
}

.combatant.hit {
	animation: shake 0.3s ease;
}

.combatant.attacking {
	animation: attack 0.3s ease;
}

.player.attacking {
	animation: attack-right 0.3s ease;
}

.enemy.attacking {
	animation: attack-left 0.3s ease;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-10px);
	}
	75% {
		transform: translateX(10px);
	}
}

@keyframes attack-right {
	0%,
	100% {
		transform: translateX(0);
	}
	50% {
		transform: translateX(30px);
	}
}

@keyframes attack-left {
	0%,
	100% {
		transform: translateX(0);
	}
	50% {
		transform: translateX(-30px);
	}
}

.combatant-sprite {
	width: 200px;
	height: 200px;
	object-fit: contain;
	filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
}

.result-display {
	position: absolute;
	font-size: 2rem;
	font-weight: bold;
	text-shadow: 0 0 20px currentColor;
}

.result-display.success {
	color: rgb(var(--brand-secondary));
}

.result-display.failure {
	color: #e74c3c;
}

.result-enter-active {
	animation: result-pop 0.3s ease;
}

.result-leave-active {
	animation: result-pop 0.3s ease reverse;
}

@keyframes result-pop {
	0% {
		transform: scale(0.5);
		opacity: 0;
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}

.dialogue-box {
	background: rgb(255 255 255 / 0.9);
	border: 2px solid rgb(var(--brand-primary));
	border-radius: 12px;
	padding: 1.5rem 2rem;
	min-height: 250px;
	backdrop-filter: blur(12px);
}

:root.dark .dialogue-box {
	background: rgb(0 0 0 / 0.8);
}

.turn-indicator {
	text-align: center;
	margin-bottom: 1rem;
	font-size: 0.9rem;
	letter-spacing: 0.1em;
	text-transform: uppercase;
}

.your-turn {
	color: rgb(var(--brand-primary));
}

.enemy-turn {
	color: #e74c3c;
}

.phrase-text {
	font-size: 1.2rem;
	text-align: center;
	margin-bottom: 1.5rem;
	line-height: 1.6;
}

.player-phrase {
	color: rgb(var(--brand-primary));
}

.enemy-phrase {
	color: #d97706;
}

:root.dark .enemy-phrase {
	color: #f1c40f;
}

.choices {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.choice-btn {
	background: rgb(0 0 0 / 0.05);
	border: 1px solid rgb(0 0 0 / 0.1);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	text-align: left;
	color: rgb(75 85 99);
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.2s ease;
}

:root.dark .choice-btn {
	background: rgb(255 255 255 / 0.05);
	border-color: rgb(255 255 255 / 0.1);
	color: rgb(170 170 170);
}

.choice-btn:hover {
	background: rgb(var(--brand-primary) / 0.2);
	border-color: rgb(var(--brand-primary));
	color: rgb(17 24 39);
	transform: translateX(8px);
}

:root.dark .choice-btn:hover {
	color: white;
}

.choice-number {
	color: rgb(var(--brand-primary));
	margin-right: 0.5rem;
}

.response-text {
	color: rgb(17 24 39);
	font-size: 1.1rem;
	text-align: center;
}

:root.dark .response-text {
	color: white;
}

.flee-choice {
	border-style: dashed;
	opacity: 0.7;
}

.flee-choice:hover {
	border-color: #e74c3c;
	color: #e74c3c;
	background: rgb(231 76 60 / 0.1);
	opacity: 1;
}

.flee-key {
	font-size: 0.7rem;
	background: rgb(0 0 0 / 0.15);
	padding: 0.15rem 0.4rem;
	border-radius: 3px;
	margin-right: 0.5rem;
	color: rgb(107 114 128);
}

:root.dark .flee-key {
	background: rgb(255 255 255 / 0.15);
	color: rgb(156 163 175);
}
</style>
