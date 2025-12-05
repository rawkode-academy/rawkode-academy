<template>
	<div class="combat-screen">
		<div class="combat-header">
			<div class="player-status">
				<span class="status-label">RED TEAM</span>
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

		<div class="combat-arena">
			<div class="combatant player" :class="{ hit: playerHit, attacking: playerAttacking }">
				<div class="combatant-sprite player-sprite"></div>
			</div>

			<Transition name="result">
				<div v-if="showResult" class="result-display" :class="resultType">
					{{ resultMessage }}
				</div>
			</Transition>

			<div class="combatant enemy" :class="{ hit: enemyHit, attacking: enemyAttacking }">
				<div class="combatant-sprite enemy-sprite"></div>
			</div>
		</div>

		<div class="dialogue-box">
			<div class="insult-text" v-if="currentInsult && !showResult">
				"{{ currentInsult.text }}"
			</div>

			<div class="choices" v-if="!isProcessing && currentInsult">
				<button
					v-for="(comeback, index) in availableComebacks"
					:key="comeback.id"
					class="choice-btn"
					@click="selectComeback(comeback)"
				>
					<span class="choice-number">{{ index + 1 }}.</span>
					{{ comeback.text }}
				</button>
			</div>

			<div v-if="isProcessing && selectedComeback" class="response-text">
				Your comeback: "{{ selectedComeback.text }}"
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { EnemyData, Insult, Comeback } from "@/game/data/types";
import { insults, comebacks, getEffectiveComebacks } from "@/game/data/insults";

const props = defineProps<{
	enemy: EnemyData;
	learnedInsults: Insult[];
	learnedComebacks: Comeback[];
}>();

const emit = defineEmits<{
	victory: [];
	defeat: [];
	learnInsult: [insult: Insult];
	learnComeback: [comeback: Comeback];
}>();

const playerHealth = ref(3);
const enemyHealth = ref(3);
const currentInsult = ref<Insult | null>(null);
const availableComebacks = ref<Comeback[]>([]);
const selectedComeback = ref<Comeback | null>(null);
const isProcessing = ref(false);
const showResult = ref(false);
const resultMessage = ref("");
const resultType = ref<"success" | "failure">("success");

const playerHit = ref(false);
const enemyHit = ref(false);
const playerAttacking = ref(false);
const enemyAttacking = ref(false);

onMounted(() => {
	startRound();
});

function startRound() {
	const available = insults.filter((i) => i.layer === props.enemy.layer || i.layer === "generic");
	currentInsult.value = available[Math.floor(Math.random() * available.length)] || null;

	if (currentInsult.value) {
		learnInsultOnSight(currentInsult.value);
		availableComebacks.value = getRandomComebacks(currentInsult.value);
	}

	isProcessing.value = false;
	selectedComeback.value = null;
}

function getRandomComebacks(_insult: Insult): Comeback[] {
	const shuffledLearned = [...props.learnedComebacks].sort(() => Math.random() - 0.5);
	const choices: Comeback[] = shuffledLearned.slice(0, 2);

	if (choices.length < 3) {
		const unlearned = comebacks.filter((c) => !props.learnedComebacks.some((l) => l.id === c.id));
		const shuffledUnlearned = [...unlearned].sort(() => Math.random() - 0.5);

		for (const candidate of shuffledUnlearned) {
			choices.push(candidate);
			learnComebackOnSight(candidate);
			if (choices.length >= 3) break;
		}
	}

	if (choices.length < 3) {
		for (const extra of shuffledLearned) {
			if (choices.some((c) => c.id === extra.id)) continue;
			choices.push(extra);
			if (choices.length >= 3) break;
		}
	}

	return choices.slice(0, 3).sort(() => Math.random() - 0.5);
}

function learnInsultOnSight(insult: Insult) {
	if (!props.learnedInsults.some((i) => i.id === insult.id)) {
		emit("learnInsult", insult);
	}
}

function learnComebackOnSight(comeback: Comeback) {
	if (!props.learnedComebacks.some((c) => c.id === comeback.id)) {
		emit("learnComeback", comeback);
	}
}

function selectComeback(comeback: Comeback) {
	if (isProcessing.value || !currentInsult.value) return;

	isProcessing.value = true;
	selectedComeback.value = comeback;

	const effective = getEffectiveComebacks(currentInsult.value.id);
	const isEffective = effective.some((e) => e.id === comeback.id);

	playerAttacking.value = true;

	setTimeout(() => {
		playerAttacking.value = false;

		if (isEffective) {
			enemyHit.value = true;
			enemyHealth.value--;
			resultMessage.value = "CRITICAL HIT!";
			resultType.value = "success";
		} else {
			enemyAttacking.value = true;
			setTimeout(() => {
				enemyAttacking.value = false;
				playerHit.value = true;
				playerHealth.value--;

				setTimeout(() => {
					playerHit.value = false;
				}, 300);
			}, 200);

			resultMessage.value = "INEFFECTIVE...";
			resultType.value = "failure";
		}

		showResult.value = true;

		setTimeout(() => {
			enemyHit.value = false;
		}, 300);

		setTimeout(() => {
			showResult.value = false;

			if (enemyHealth.value <= 0) {
				emit("victory");
			} else if (playerHealth.value <= 0) {
				emit("defeat");
			} else {
				startRound();
			}
		}, 1500);
	}, 300);
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
	color: #04b59c;
}

.enemy-status .status-label {
	color: #e74c3c;
}

.health-bar {
	font-size: 1.5rem;
	letter-spacing: 4px;
}

.vs {
	color: #666;
	font-size: 1.5rem;
	font-weight: bold;
}

.combat-arena {
	flex: 1;
	display: flex;
	justify-content: space-around;
	align-items: center;
	position: relative;
	padding: 2rem;
}

.combatant {
	transition: transform 0.2s ease;
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
	width: 120px;
	height: 120px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 3rem;
}

.player-sprite {
	background: linear-gradient(135deg, #04b59c 0%, #028a75 100%);
	box-shadow: 0 0 30px rgba(4, 181, 156, 0.4);
}

.enemy-sprite {
	background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
	box-shadow: 0 0 30px rgba(231, 76, 60, 0.4);
}

.result-display {
	position: absolute;
	font-size: 2rem;
	font-weight: bold;
	text-shadow: 0 0 20px currentColor;
}

.result-display.success {
	color: #85ff95;
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
	background: rgba(0, 0, 0, 0.8);
	border: 2px solid #04b59c;
	border-radius: 12px;
	padding: 1.5rem 2rem;
	min-height: 250px;
}

.insult-text {
	color: #f1c40f;
	font-size: 1.2rem;
	text-align: center;
	margin-bottom: 1.5rem;
	line-height: 1.6;
}

.choices {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.choice-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	padding: 1rem 1.5rem;
	text-align: left;
	color: #aaa;
	font-family: inherit;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.2s ease;
}

.choice-btn:hover {
	background: rgba(4, 181, 156, 0.2);
	border-color: #04b59c;
	color: #fff;
	transform: translateX(8px);
}

.choice-number {
	color: #04b59c;
	margin-right: 0.5rem;
}

.response-text {
	color: #fff;
	font-size: 1.1rem;
	text-align: center;
}
</style>
