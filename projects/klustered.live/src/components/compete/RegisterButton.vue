<script setup lang="ts">
import { ref, computed } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isRegistered: boolean;
	signInUrl: string;
	pagePath: string;
}>();

const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);

function createSource(): string {
	return `klustered.live:compete-registration:${props.pagePath}`;
}

const showRegisteredState = computed(() => {
	return props.isRegistered || isSuccess.value;
});

const register = async () => {
	if (isLoading.value) return;
	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } =
			await actions.newsletter.registerCompetitor({
				source: createSource(),
			});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) isSuccess.value = true;
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Failed to register. Please try again.";
	} finally {
		isLoading.value = false;
	}
};
</script>

<template>
	<div class="button-container">
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

		<!-- Registered State -->
		<Transition
			enter-active-class="transition duration-300 ease-out"
			enter-from-class="opacity-0 scale-95"
			enter-to-class="opacity-100 scale-100"
		>
			<div v-if="showRegisteredState" class="registered-state">
				<svg class="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="registered-text">
					{{ isSuccess ? "You're registered!" : "Registered" }}
				</span>
			</div>
		</Transition>

		<!-- Sign In Required -->
		<template v-if="!isSignedIn && !showRegisteredState">
			<a :href="signInUrl" class="signin-button">
				<svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
				</svg>
				Sign in to Register
			</a>
		</template>

		<!-- Register Button (Signed In) -->
		<template v-if="isSignedIn && !showRegisteredState">
			<button
				@click="register"
				:disabled="isLoading"
				class="register-button"
			>
				<span class="button-content">
					<svg v-if="isLoading" class="spinner" fill="none" viewBox="0 0 24 24">
						<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
					</svg>
					<svg v-else class="trophy-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
					</svg>
					{{ isLoading ? "Registering..." : "Register to Compete" }}
				</span>
			</button>
		</template>
	</div>
</template>

<style scoped>
.button-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
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

.registered-state {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 1rem 2rem;
	border-radius: 0.75rem;
	background: linear-gradient(to right, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.15));
	border: 1px solid rgba(34, 197, 94, 0.3);
}

.check-icon {
	width: 1.5rem;
	height: 1.5rem;
	color: #22c55e;
}

.registered-text {
	font-size: 1rem;
	font-weight: 600;
	color: #86efac;
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

.register-button {
	padding: 1rem 2rem;
	border-radius: 0.75rem;
	font-size: 1rem;
	font-weight: 600;
	background: linear-gradient(135deg, #8b5cf6, #a855f7);
	color: white;
	border: none;
	cursor: pointer;
	transition: all 0.2s;
}

.register-button:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 15px 30px -5px rgba(139, 92, 246, 0.5);
}

.register-button:disabled {
	opacity: 0.7;
	cursor: wait;
}

.button-content {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
}

.spinner {
	width: 1.25rem;
	height: 1.25rem;
	animation: spin 1s linear infinite;
}

.spinner-track {
	opacity: 0.25;
}

.spinner-head {
	opacity: 0.75;
}

.trophy-icon {
	width: 1.25rem;
	height: 1.25rem;
	transition: transform 0.2s;
}

.register-button:hover .trophy-icon {
	transform: scale(1.1);
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
