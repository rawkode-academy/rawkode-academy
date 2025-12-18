<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isSoloRegistered: boolean;
	isTeamRegistered: boolean;
	signInUrl: string;
	pagePath: string;
}>();

const isLoading = ref<"solo" | "team" | "both" | null>(null);
const error = ref<string | null>(null);

const localSoloRegistered = ref(props.isSoloRegistered);
const localTeamRegistered = ref(props.isTeamRegistered);

watch(() => props.isSoloRegistered, (val) => localSoloRegistered.value = val);
watch(() => props.isTeamRegistered, (val) => localTeamRegistered.value = val);

const isBothRegistered = computed(() =>
	localSoloRegistered.value && localTeamRegistered.value
);

const isPartiallyRegistered = computed(() =>
	(localSoloRegistered.value || localTeamRegistered.value) && !isBothRegistered.value
);

function createSource(): string {
	return `klustered.live:compete-registration:${props.pagePath}`;
}

function getCardSelectedState(cardId: string): boolean {
	if (cardId === "solo") return localSoloRegistered.value;
	if (cardId === "team") return localTeamRegistered.value;
	if (cardId === "both") return isBothRegistered.value;
	return false;
}

function getCardActionText(cardId: string): string {
	const isSelected = getCardSelectedState(cardId);
	if (isLoading.value === cardId) {
		return isSelected ? "Unregistering..." : "Registering...";
	}
	return isSelected ? "Click to unregister" : "Click to register";
}

async function toggleSingle(type: "solo" | "team") {
	isLoading.value = type;
	error.value = null;

	const isCurrentlyRegistered = type === "solo"
		? localSoloRegistered.value
		: localTeamRegistered.value;

	try {
		const { data, error: actionError } = await actions.newsletter.updateCompetitorRegistration({
			type,
			action: isCurrentlyRegistered ? "unsubscribe" : "subscribe",
			source: createSource(),
		});

		if (actionError) throw new Error(actionError.message);

		if (type === "solo") {
			localSoloRegistered.value = !isCurrentlyRegistered;
		} else {
			localTeamRegistered.value = !isCurrentlyRegistered;
		}
	} catch (err: unknown) {
		error.value = err instanceof Error ? err.message : "Failed to update registration.";
	} finally {
		isLoading.value = null;
	}
}

async function toggleBoth() {
	isLoading.value = "both";
	error.value = null;

	const targetState = !isBothRegistered.value;

	try {
		const results = await Promise.all([
			actions.newsletter.updateCompetitorRegistration({
				type: "solo",
				action: targetState ? "subscribe" : "unsubscribe",
				source: createSource(),
			}),
			actions.newsletter.updateCompetitorRegistration({
				type: "team",
				action: targetState ? "subscribe" : "unsubscribe",
				source: createSource(),
			}),
		]);

		const hasError = results.some(r => r.error);
		if (hasError) throw new Error("Failed to update one or more registrations.");

		localSoloRegistered.value = targetState;
		localTeamRegistered.value = targetState;
	} catch (err: unknown) {
		error.value = err instanceof Error ? err.message : "Failed to update registration.";
	} finally {
		isLoading.value = null;
	}
}

function handleCardClick(cardId: "solo" | "team" | "both") {
	if (isLoading.value) return;

	if (cardId === "both") {
		toggleBoth();
	} else {
		toggleSingle(cardId);
	}
}
</script>

<template>
	<div class="registration-container">
		<!-- Error State -->
		<Transition
			enter-active-class="transition duration-200 ease-out"
			enter-from-class="opacity-0 -translate-y-1"
			enter-to-class="opacity-100 translate-y-0"
			leave-active-class="transition duration-150 ease-in"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div v-if="error" class="error-state">
				<svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				{{ error }}
			</div>
		</Transition>

		<!-- Sign In Required -->
		<template v-if="!isSignedIn">
			<p class="sign-in-prompt">Sign in to register for competition</p>
			<a :href="signInUrl" class="signin-button">
				<svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
				</svg>
				Sign in with GitHub
			</a>
		</template>

		<!-- Card Selection (Signed In) -->
		<template v-else>
			<div class="cards-grid">
				<!-- Solo Card -->
				<button
					@click="handleCardClick('solo')"
					:disabled="!!isLoading"
					:class="[
						'registration-card',
						{
							'card-selected': localSoloRegistered,
							'card-loading': isLoading === 'solo',
						}
					]"
				>
					<div v-if="isLoading === 'solo'" class="card-icon-container">
						<svg class="spinner" fill="none" viewBox="0 0 24 24">
							<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					</div>
					<div v-else-if="localSoloRegistered" class="card-icon-container card-check">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<div v-else class="card-icon-container">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<h3 class="card-title">Solo</h3>
					<p class="card-description">Compete individually against the cluster chaos</p>
					<span class="card-action">{{ getCardActionText('solo') }}</span>
				</button>

				<!-- Team Card -->
				<button
					@click="handleCardClick('team')"
					:disabled="!!isLoading"
					:class="[
						'registration-card',
						{
							'card-selected': localTeamRegistered,
							'card-loading': isLoading === 'team',
						}
					]"
				>
					<div v-if="isLoading === 'team'" class="card-icon-container">
						<svg class="spinner" fill="none" viewBox="0 0 24 24">
							<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					</div>
					<div v-else-if="localTeamRegistered" class="card-icon-container card-check">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<div v-else class="card-icon-container">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					</div>
					<h3 class="card-title">Team</h3>
					<p class="card-description">Collaborate with a team to conquer the chaos</p>
					<span class="card-action">{{ getCardActionText('team') }}</span>
				</button>

				<!-- Both Card -->
				<button
					@click="handleCardClick('both')"
					:disabled="!!isLoading"
					:class="[
						'registration-card',
						{
							'card-selected': isBothRegistered,
							'card-partial': isPartiallyRegistered,
							'card-loading': isLoading === 'both',
						}
					]"
				>
					<div v-if="isLoading === 'both'" class="card-icon-container">
						<svg class="spinner" fill="none" viewBox="0 0 24 24">
							<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					</div>
					<div v-else-if="isBothRegistered" class="card-icon-container card-check">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<div v-else class="card-icon-container">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
						</svg>
					</div>
					<h3 class="card-title">Both</h3>
					<p class="card-description">Register for both solo and team competitions</p>
					<span class="card-action">{{ getCardActionText('both') }}</span>
				</button>
			</div>
		</template>
	</div>
</template>

<style scoped>
.registration-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1rem;
	width: 100%;
}

.error-state {
	padding: 0.625rem 1rem;
	border-radius: 0.5rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	color: #fca5a5;
	font-size: 0.875rem;
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.error-icon {
	width: 1.25rem;
	height: 1.25rem;
	flex-shrink: 0;
}

.sign-in-prompt {
	color: rgba(255, 255, 255, 0.7);
	font-size: 0.875rem;
	margin-bottom: 0.5rem;
}

.signin-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	padding: 1rem 2rem;
	border-radius: 0.75rem;
	font-size: 1rem;
	font-weight: 600;
	color: white;
	background: #24292e;
	border: 1px solid rgba(255, 255, 255, 0.1);
	text-decoration: none;
	transition: all 0.2s;
}

.signin-button:hover {
	background: #2f363d;
	transform: translateY(-2px);
	box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
}

.github-icon {
	width: 1.25rem;
	height: 1.25rem;
}

.cards-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 1rem;
	width: 100%;
}

@media (max-width: 768px) {
	.cards-grid {
		grid-template-columns: 1fr;
	}
}

.registration-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 1.5rem 1rem;
	border-radius: 0.75rem;
	background: rgba(255, 255, 255, 0.05);
	border: 2px solid rgba(139, 92, 246, 0.2);
	cursor: pointer;
	transition: all 0.2s ease;
	text-align: center;
}

.registration-card:hover:not(:disabled) {
	transform: translateY(-2px);
	border-color: rgba(139, 92, 246, 0.4);
	box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.3);
}

.registration-card:disabled {
	opacity: 0.7;
	cursor: not-allowed;
}

.card-selected {
	background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1));
	border-color: rgba(34, 197, 94, 0.4);
}

.card-selected:hover:not(:disabled) {
	border-color: rgba(239, 68, 68, 0.4);
	box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.2);
}

.card-partial {
	border-style: dashed;
	border-color: rgba(251, 191, 36, 0.4);
}

.card-icon-container {
	width: 3rem;
	height: 3rem;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 0.75rem;
	color: rgba(255, 255, 255, 0.7);
}

.card-icon-container svg {
	width: 2rem;
	height: 2rem;
}

.card-check {
	color: #22c55e;
}

.card-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: white;
	margin-bottom: 0.5rem;
}

.card-description {
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.6);
	margin-bottom: 1rem;
	line-height: 1.4;
}

.card-action {
	font-size: 0.75rem;
	color: rgba(139, 92, 246, 0.8);
	font-weight: 500;
}

.card-selected .card-action {
	color: rgba(34, 197, 94, 0.8);
}

.card-selected:hover:not(:disabled) .card-action {
	color: rgba(239, 68, 68, 0.8);
}

.spinner {
	width: 1.5rem;
	height: 1.5rem;
	animation: spin 1s linear infinite;
}

.spinner-track {
	opacity: 0.25;
}

.spinner-head {
	opacity: 0.75;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
