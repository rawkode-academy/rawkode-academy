<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isSubscribed: boolean;
	signInUrl: string;
	pagePath: string;
	audience?: string;
}>();

const audience = props.audience || "klustered-watch";
const NEWSLETTER_COOKIE_NAME = `newsletter:${audience}:updates`;

const email = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const isExpanded = ref(false);
const hasCookieSubscription = ref(false);
const emailInput = ref<HTMLInputElement | null>(null);

function createSource(): string {
	return `klustered.dev:newsletter:${props.pagePath}`;
}

function checkNewsletterCookie(): boolean {
	try {
		const cookies = document.cookie;
		if (!cookies) return false;
		const cookiePairs = cookies.split(";");
		for (const pair of cookiePairs) {
			const [name, value] = pair.trim().split("=");
			if (name === NEWSLETTER_COOKIE_NAME && value === "true") {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

onMounted(() => {
	if (!props.isSignedIn) {
		hasCookieSubscription.value = checkNewsletterCookie();
	}
});

const shouldHide = computed(() => {
	if (props.isSignedIn && props.isSubscribed) return false;
	if (!props.isSignedIn && hasCookieSubscription.value) return true;
	return false;
});

const showSubscribedState = computed(() => {
	return (props.isSignedIn && props.isSubscribed) || isSuccess.value;
});

const subscribeAsLearner = async () => {
	if (isLoading.value) return;
	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.newsletter.subscribe({
			audience,
			source: createSource(),
		});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) isSuccess.value = true;
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Failed to subscribe. Please try again.";
	} finally {
		isLoading.value = false;
	}
};

const subscribeWithEmail = async () => {
	if (isLoading.value || !email.value.trim()) return;
	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } =
			await actions.newsletter.subscribeWithEmail({
				email: email.value.trim(),
				audience,
				source: createSource(),
			});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) {
			isSuccess.value = true;
			hasCookieSubscription.value = true;
		}
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Failed to subscribe. Please try again.";
	} finally {
		isLoading.value = false;
	}
};

const handleSubmit = () => {
	if (props.isSignedIn) {
		subscribeAsLearner();
	} else {
		subscribeWithEmail();
	}
};

const expandForm = async () => {
	isExpanded.value = true;
	error.value = null;
	await nextTick();
	emailInput.value?.focus();
};
</script>

<template>
	<template v-if="!shouldHide">
		<div class="widget-container">
			<!-- Success State -->
			<Transition
				enter-active-class="transition duration-300 ease-out"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
			>
				<div v-if="showSubscribedState" class="success-state">
					<svg class="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="success-text">
						{{ isSuccess ? "You're in!" : "Subscribed" }}
					</span>
				</div>
			</Transition>

			<!-- Main CTA -->
			<div v-if="!showSubscribedState" class="cta-container">
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

				<!-- Signed-in user -->
				<template v-if="isSignedIn">
					<button
						@click="subscribeAsLearner"
						:disabled="isLoading"
						class="subscribe-button"
					>
						<span class="button-content">
							<svg v-if="isLoading" class="spinner" fill="none" viewBox="0 0 24 24">
								<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
							<svg v-else class="bell-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
							</svg>
							{{ isLoading ? "Subscribing..." : "Subscribe" }}
						</span>
					</button>
				</template>

				<!-- Anonymous user -->
				<template v-else>
					<!-- Collapsed state -->
					<Transition
						enter-active-class="transition duration-200 ease-out"
						enter-from-class="opacity-0"
						enter-to-class="opacity-100"
						leave-active-class="transition duration-150 ease-in"
						leave-from-class="opacity-100"
						leave-to-class="opacity-0"
						mode="out-in"
					>
						<button
							v-if="!isExpanded"
							@click="expandForm"
							class="subscribe-button"
						>
							<span class="button-content">
								<svg class="email-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Subscribe
							</span>
						</button>

						<!-- Expanded form -->
						<form v-else @submit.prevent="handleSubmit" class="expanded-form">
							<!-- Email input with integrated submit -->
							<div class="input-container">
								<input
									ref="emailInput"
									v-model="email"
									type="email"
									placeholder="you@example.com"
									required
									:disabled="isLoading"
									class="email-input"
								/>
								<button
									type="submit"
									:disabled="isLoading || !email.trim()"
									class="submit-button"
									:title="isLoading ? 'Subscribing...' : 'Subscribe'"
								>
									<svg v-if="isLoading" class="spinner-small" fill="none" viewBox="0 0 24 24">
										<circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else class="arrow-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								</button>
							</div>

							<!-- Sign in option -->
							<div class="divider">
								<div class="divider-line"></div>
								<span class="divider-text">or</span>
								<div class="divider-line"></div>
							</div>

							<a :href="signInUrl" class="signin-link">
								Continue with Sign in
							</a>
						</form>
					</Transition>
				</template>
			</div>
		</div>
	</template>
</template>

<style scoped>
.widget-container {
	width: 100%;
}

.success-state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.625rem 1rem;
	border-radius: 0.75rem;
	background: linear-gradient(to right, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1));
	border: 1px solid rgba(34, 197, 94, 0.2);
}

.success-icon {
	width: 1.25rem;
	height: 1.25rem;
	color: #22c55e;
}

.success-text {
	font-size: 0.875rem;
	font-weight: 500;
	color: #86efac;
}

.cta-container {
	width: 100%;
}

.error-state {
	margin-bottom: 0.5rem;
	padding: 0.625rem;
	border-radius: 0.5rem;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.3);
	color: #fca5a5;
	font-size: 0.75rem;
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.error-icon {
	width: 1rem;
	height: 1rem;
	flex-shrink: 0;
}

.subscribe-button {
	width: 100%;
	padding: 0.625rem 1rem;
	border-radius: 0.75rem;
	font-size: 0.875rem;
	font-weight: 600;
	background: linear-gradient(135deg, #8b5cf6, #a855f7);
	color: white;
	border: none;
	cursor: pointer;
	transition: all 0.2s;
}

.subscribe-button:hover:not(:disabled) {
	transform: translateY(-1px);
	box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.4);
}

.subscribe-button:disabled {
	opacity: 0.7;
	cursor: wait;
}

.button-content {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
}

.spinner, .spinner-small {
	animation: spin 1s linear infinite;
}

.spinner {
	width: 1rem;
	height: 1rem;
}

.spinner-small {
	width: 1rem;
	height: 1rem;
}

.spinner-track {
	opacity: 0.25;
}

.spinner-head {
	opacity: 0.75;
}

.bell-icon, .email-icon {
	width: 1rem;
	height: 1rem;
	transition: transform 0.2s;
}

.subscribe-button:hover .bell-icon,
.subscribe-button:hover .email-icon {
	transform: scale(1.1);
}

.expanded-form {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.input-container {
	position: relative;
}

.email-input {
	width: 100%;
	padding: 0.625rem 3rem 0.625rem 1rem;
	border-radius: 0.75rem;
	border: 2px solid rgba(255, 255, 255, 0.1);
	background: rgba(255, 255, 255, 0.05);
	color: white;
	font-size: 0.875rem;
	transition: all 0.2s;
}

.email-input::placeholder {
	color: rgba(255, 255, 255, 0.4);
}

.email-input:focus {
	outline: none;
	border-color: #a855f7;
	box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
}

.email-input:disabled {
	opacity: 0.6;
}

.submit-button {
	position: absolute;
	right: 0.375rem;
	top: 50%;
	transform: translateY(-50%);
	padding: 0.375rem;
	border-radius: 0.5rem;
	background: linear-gradient(135deg, #8b5cf6, #a855f7);
	color: white;
	border: none;
	cursor: pointer;
	transition: all 0.2s;
}

.submit-button:hover:not(:disabled) {
	background: linear-gradient(135deg, #7c3aed, #9333ea);
}

.submit-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.arrow-icon {
	width: 1rem;
	height: 1rem;
}

.divider {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.divider-line {
	flex: 1;
	height: 1px;
	background: rgba(255, 255, 255, 0.1);
}

.divider-text {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.4);
}

.signin-link {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	border-radius: 0.75rem;
	padding: 0.625rem 1.25rem;
	font-size: 0.875rem;
	font-weight: 600;
	color: white;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	text-decoration: none;
	transition: all 0.2s;
}

.signin-link:hover {
	background: rgba(255, 255, 255, 0.15);
	transform: translateY(-1px);
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
