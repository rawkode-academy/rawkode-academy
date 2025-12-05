<template>
	<div class="allocation-screen">
		<div class="grid-bg"></div>

		<div class="content">
			<h2 class="title">INITIALIZING ARSENAL</h2>
			<p class="subtitle">Spinning up your starting kit...</p>

			<div class="slots-container">
				<div class="slot-section">
					<h3 class="section-title">INSULTS</h3>
					<div class="slots">
						<div
							v-for="(slot, index) in insultSlots"
							:key="'insult-' + index"
							class="slot"
							:class="{ spinning: slot.spinning, revealed: slot.revealed }"
						>
							<div class="slot-reel" :style="{ transform: `translateY(${slot.offset}px)` }">
								<div v-for="insult in allInsults" :key="insult.id" class="slot-item">
									{{ insult.text.slice(0, 50) }}...
								</div>
							</div>
							<div v-if="slot.revealed" class="revealed-item">
								<span class="item-icon">⚔️</span>
								<span class="item-text">{{ slot.result?.text }}</span>
							</div>
						</div>
					</div>
				</div>

				<div class="slot-section">
					<h3 class="section-title">COMEBACKS</h3>
					<div class="slots">
						<div
							v-for="(slot, index) in comebackSlots"
							:key="'comeback-' + index"
							class="slot"
							:class="{ spinning: slot.spinning, revealed: slot.revealed }"
						>
							<div class="slot-reel" :style="{ transform: `translateY(${slot.offset}px)` }">
								<div v-for="comeback in allComebacks" :key="comeback.id" class="slot-item">
									{{ comeback.text.slice(0, 50) }}...
								</div>
							</div>
							<div v-if="slot.revealed" class="revealed-item">
								<span class="item-icon">🛡️</span>
								<span class="item-text">{{ slot.result?.text }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<button
				v-if="!isSpinning && !allRevealed"
				class="spin-btn"
				@click="startSpin"
			>
				<span class="btn-text">[ SPIN TO REVEAL ]</span>
			</button>

			<button
				v-if="allRevealed"
				class="continue-btn"
				@click="$emit('continue', selectedInsults, selectedComebacks)"
			>
				<span class="btn-text">[ BEGIN MISSION ]</span>
			</button>

			<div v-if="allRevealed" class="summary">
				<p>Your arsenal is ready. Use these wisely.</p>
				<p class="hint">You'll learn new insults and comebacks as soon as you encounter them.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Insult, Comeback } from "@/game/data/types";
import { insults, comebacks } from "@/game/data/insults";

interface SlotState<T> {
	spinning: boolean;
	revealed: boolean;
	offset: number;
	result: T | null;
}

const emit = defineEmits<{
	continue: [insults: Insult[], comebacks: Comeback[]];
}>();

const allInsults = insults;
const allComebacks = comebacks;

const insultSlots = ref<SlotState<Insult>[]>([
	{ spinning: false, revealed: false, offset: 0, result: null },
	{ spinning: false, revealed: false, offset: 0, result: null },
]);

const comebackSlots = ref<SlotState<Comeback>[]>([
	{ spinning: false, revealed: false, offset: 0, result: null },
	{ spinning: false, revealed: false, offset: 0, result: null },
]);

const isSpinning = ref(false);

const allRevealed = computed(() =>
	insultSlots.value.every((s) => s.revealed) &&
	comebackSlots.value.every((s) => s.revealed)
);

const selectedInsults = computed(() =>
	insultSlots.value.map((s) => s.result).filter((r): r is Insult => r !== null)
);

const selectedComebacks = computed(() =>
	comebackSlots.value.map((s) => s.result).filter((r): r is Comeback => r !== null)
);

function getRandomItems<T>(array: T[], count: number, exclude: T[] = []): T[] {
	const available = array.filter((item) => !exclude.includes(item));
	const shuffled = [...available].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}

function startSpin() {
	if (isSpinning.value) return;
	isSpinning.value = true;

	const selectedInsultItems = getRandomItems(allInsults, 2);
	const selectedComebackItems = getRandomItems(allComebacks, 2);

	insultSlots.value.forEach((slot, index) => {
		slot.spinning = true;
		slot.result = selectedInsultItems[index] || null;
	});

	comebackSlots.value.forEach((slot, index) => {
		slot.spinning = true;
		slot.result = selectedComebackItems[index] || null;
	});

	animateSlots();
}

function animateSlots() {
	const itemHeight = 60;
	const totalItems = allInsults.length;
	let frame = 0;
	const spinDuration = 2000;
	const staggerDelay = 400;

	const allSlots = [...insultSlots.value, ...comebackSlots.value];

	function animate() {
		frame++;
		const elapsed = frame * 16;

		allSlots.forEach((slot, index) => {
			const slotStart = index * staggerDelay;
			const slotElapsed = elapsed - slotStart;

			if (slotElapsed > 0 && slot.spinning) {
				const progress = Math.min(slotElapsed / spinDuration, 1);
				const eased = 1 - Math.pow(1 - progress, 3);
				const spins = 3 + index * 0.5;
				slot.offset = -eased * spins * totalItems * itemHeight;

				if (progress >= 1) {
					slot.spinning = false;
					slot.revealed = true;
				}
			}
		});

		if (allSlots.some((s) => s.spinning)) {
			requestAnimationFrame(animate);
		} else {
			isSpinning.value = false;
		}
	}

	requestAnimationFrame(animate);
}
</script>

<style scoped>
.allocation-screen {
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
		linear-gradient(rgba(4, 181, 156, 0.1) 1px, transparent 1px),
		linear-gradient(90deg, rgba(4, 181, 156, 0.1) 1px, transparent 1px);
	background-size: 40px 40px;
	animation: grid-move 20s linear infinite;
}

@keyframes grid-move {
	0% {
		transform: translate(0, 0);
	}
	100% {
		transform: translate(40px, 40px);
	}
}

.content {
	text-align: center;
	z-index: 1;
	max-width: 900px;
	width: 100%;
}

.title {
	font-size: 2.5rem;
	font-weight: 700;
	color: #04b59c;
	text-shadow: 0 0 20px rgba(4, 181, 156, 0.5);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: #888;
	font-size: 1.1rem;
	margin-bottom: 2rem;
}

.slots-container {
	display: flex;
	flex-direction: column;
	gap: 2rem;
	margin-bottom: 2rem;
}

.slot-section {
	background: rgba(0, 0, 0, 0.6);
	border: 1px solid rgba(4, 181, 156, 0.3);
	border-radius: 12px;
	padding: 1.5rem;
}

.section-title {
	color: #04b59c;
	font-size: 1rem;
	letter-spacing: 0.2em;
	margin-bottom: 1rem;
}

.slots {
	display: flex;
	gap: 1rem;
	justify-content: center;
}

.slot {
	width: 100%;
	max-width: 350px;
	height: 80px;
	background: rgba(0, 0, 0, 0.8);
	border: 2px solid #333;
	border-radius: 8px;
	overflow: hidden;
	position: relative;
}

.slot.spinning {
	border-color: #04b59c;
	box-shadow: 0 0 20px rgba(4, 181, 156, 0.3);
}

.slot.revealed {
	border-color: #85ff95;
	box-shadow: 0 0 20px rgba(133, 255, 149, 0.3);
}

.slot-reel {
	position: absolute;
	width: 100%;
	transition: transform 0.05s linear;
}

.slot-item {
	height: 60px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.5rem;
	color: #666;
	font-size: 0.8rem;
	text-align: center;
	border-bottom: 1px solid #222;
}

.revealed-item {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	padding: 0.75rem;
	background: rgba(0, 0, 0, 0.95);
	animation: reveal-pop 0.3s ease;
}

@keyframes reveal-pop {
	0% {
		transform: scale(0.8);
		opacity: 0;
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}

.item-icon {
	font-size: 1.5rem;
	flex-shrink: 0;
}

.item-text {
	color: #85ff95;
	font-size: 0.85rem;
	text-align: left;
	line-height: 1.4;
}

.spin-btn,
.continue-btn {
	background: transparent;
	border: 2px solid #04b59c;
	color: #04b59c;
	padding: 1rem 2.5rem;
	font-family: inherit;
	font-size: 1.2rem;
	cursor: pointer;
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
	margin-top: 1rem;
}

.spin-btn::before,
.continue-btn::before {
	content: "";
	position: absolute;
	inset: 0;
	background: #04b59c;
	transform: translateX(-100%);
	transition: transform 0.3s ease;
	z-index: -1;
}

.spin-btn:hover,
.continue-btn:hover {
	color: #1a1a2e;
}

.spin-btn:hover::before,
.continue-btn:hover::before {
	transform: translateX(0);
}

.continue-btn {
	border-color: #85ff95;
	color: #85ff95;
}

.continue-btn::before {
	background: #85ff95;
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

.summary {
	margin-top: 2rem;
	color: #666;
	font-size: 0.9rem;
}

.hint {
	color: #04b59c;
	margin-top: 0.5rem;
}
</style>
