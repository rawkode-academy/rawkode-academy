<template>
	<div :class="gameTheme.root" class="allocation-screen">
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
				@click="$emit('continue')"
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
import { academyGame } from "@rawkodeacademy/design-system";
const gameTheme = academyGame();
import { ref, computed } from "vue";
import type { Insult, Comeback } from "@/game/data/types";
import { insults, comebacks } from "@/game/data/insults";

interface SlotState<T> {
	spinning: boolean;
	revealed: boolean;
	offset: number;
	result: T | null;
}

const props = defineProps<{
	assignedInsults: Insult[];
	assignedComebacks: Comeback[];
}>();

const emit = defineEmits<{
	continue: [];
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

const allRevealed = computed(
	() =>
		insultSlots.value.every((s) => s.revealed) &&
		comebackSlots.value.every((s) => s.revealed),
);

function startSpin() {
	if (isSpinning.value) return;
	isSpinning.value = true;

	// Use the pre-assigned phrases from the backend
	insultSlots.value.forEach((slot, index) => {
		slot.spinning = true;
		slot.result = props.assignedInsults[index] || null;
	});

	comebackSlots.value.forEach((slot, index) => {
		slot.spinning = true;
		slot.result = props.assignedComebacks[index] || null;
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
		linear-gradient(color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px),
		linear-gradient(90deg, color-mix(in srgb, var(--colors-academy-accent) 10.0%, transparent) 1px, transparent 1px);
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
	color: var(--colors-academy-accent);
	text-shadow: 0 0 20px color-mix(in srgb, var(--colors-academy-accent) 50.0%, transparent);
	letter-spacing: 0.1em;
	margin-bottom: 0.5rem;
}

.subtitle {
	color: var(--colors-academy-text-muted);
	font-size: 1.1rem;
	margin-bottom: 2rem;
}

:root.dark .subtitle {
	color: var(--colors-academy-text-muted);
}

.slots-container {
	display: flex;
	flex-direction: column;
	gap: 2rem;
	margin-bottom: 2rem;
}

.slot-section {
	background: var(--colors-academy-panel);
	border: 1px solid color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
	border-radius: 12px;
	padding: 1.5rem;
	backdrop-filter: blur(8px);
}

:root.dark .slot-section {
	background: var(--colors-academy-panel);
}

.section-title {
	color: var(--colors-academy-accent);
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
	background: var(--colors-academy-panel);
	border: 2px solid var(--colors-academy-border);
	border-radius: 8px;
	overflow: hidden;
	position: relative;
}

:root.dark .slot {
	background: var(--colors-academy-panel);
	border-color: var(--colors-academy-border);
}

.slot.spinning {
	border-color: var(--colors-academy-accent);
	box-shadow: 0 0 20px color-mix(in srgb, var(--colors-academy-accent) 30.0%, transparent);
}

.slot.revealed {
	border-color: var(--colors-academy-status-violet);
	box-shadow: 0 0 20px color-mix(in srgb, var(--colors-academy-status-violet) 30.0%, transparent);
}

.slot-reel {
	position: absolute;
	width: 100%;
	transition: transform 0.05s linear;
	user-select: none;
	pointer-events: none;
}

.slot-item {
	height: 60px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.5rem;
	color: var(--colors-academy-text-muted);
	font-size: 0.8rem;
	text-align: center;
	border-bottom: 1px solid var(--colors-academy-border);
}

:root.dark .slot-item {
	color: var(--colors-academy-text-muted);
	border-bottom-color: var(--colors-academy-border);
}

.revealed-item {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	padding: 0.75rem;
	background: var(--colors-academy-panel);
	animation: reveal-pop 0.3s ease;
}

:root.dark .revealed-item {
	background: var(--colors-academy-panel);
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
	color: var(--colors-academy-status-violet);
	font-size: 0.85rem;
	text-align: left;
	line-height: 1.4;
}

.spin-btn,
.continue-btn {
	background: transparent;
	border: 2px solid var(--colors-academy-accent);
	color: var(--colors-academy-accent);
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
	background: var(--colors-academy-accent);
	transform: translateX(-100%);
	transition: transform 0.3s ease;
	z-index: -1;
}

.spin-btn:hover,
.continue-btn:hover {
	color: white;
}

:root.dark .spin-btn:hover,
:root.dark .continue-btn:hover {
	color: var(--colors-academy-text);
}

.spin-btn:hover::before,
.continue-btn:hover::before {
	transform: translateX(0);
}

.continue-btn {
	border-color: var(--colors-academy-status-violet);
	color: var(--colors-academy-status-violet);
}

.continue-btn::before {
	background: var(--colors-academy-status-violet);
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
	color: var(--colors-academy-text-muted);
	font-size: 0.9rem;
}

:root.dark .summary {
	color: var(--colors-academy-text-muted);
}

.hint {
	color: var(--colors-academy-accent);
	margin-top: 0.5rem;
}

@media (max-width: 768px) {
	.allocation-screen {
		padding: 1.5rem 1rem;
		min-height: calc(100vh - 140px);
		align-items: flex-start;
	}

	.title {
		font-size: 2rem;
	}

	.subtitle {
		font-size: 1rem;
	}

	.slot-section {
		padding: 1rem;
	}

	.slots {
		flex-direction: column;
	}

	.slot {
		max-width: none;
	}

	.spin-btn,
	.continue-btn {
		width: 100%;
		max-width: 320px;
	}
}
</style>
