<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	technologyId: string;
	technologyName: string;
	signInUrl: string;
	pagePath: string;
}>();

const TECHNOLOGY_COOKIE_PREFIX = "technology:updates:";
const AUTH_COOKIE_NAME = "better-auth.session_token";
const SECURE_AUTH_COOKIE_NAME = "__Secure-better-auth.session_token";

const email = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const showEmailForm = ref(false);

// Success state
const isSubscribed = ref(false);

// Cookie-based state
const hasCookie = ref(false);
const isSignedIn = ref(false);

/**
 * Create a source string for tracking subscriptions.
 */
function createSource(): string {
	return `website:technology:${props.technologyId}`;
}

/**
 * Check if the user appears to be signed in based on auth cookies.
 */
function checkAuthCookie(): boolean {
	try {
		const cookies = document.cookie;
		if (!cookies) return false;

		const cookiePairs = cookies.split(";");
		for (const pair of cookiePairs) {
			const name = pair.trim().split("=")[0];
			if (name === AUTH_COOKIE_NAME || name === SECURE_AUTH_COOKIE_NAME) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check for technology-specific cookie.
 */
function checkTechnologyCookie(): boolean {
	try {
		const cookies = document.cookie;
		if (!cookies) return false;

		const cookiePairs = cookies.split(";");
		for (const pair of cookiePairs) {
			const [name] = pair.trim().split("=");
			if (name === `${TECHNOLOGY_COOKIE_PREFIX}${props.technologyId}`) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

onMounted(() => {
	// Check auth state
	isSignedIn.value = checkAuthCookie();

	// Check technology-specific cookie for anonymous users
	if (!isSignedIn.value) {
		hasCookie.value = checkTechnologyCookie();
	}
});

// Computed state
const showSuccess = computed(() => {
	return isSubscribed.value || hasCookie.value;
});

// Handlers
const subscribe = async () => {
	if (isLoading.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.subscribeToUpdates({
			technologyId: props.technologyId,
			source: createSource(),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			isSubscribed.value = true;
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

const subscribeWithEmail = async () => {
	if (isLoading.value || !email.value.trim()) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.subscribeToUpdatesWithEmail({
			email: email.value.trim(),
			technologyId: props.technologyId,
			source: createSource(),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			isSubscribed.value = true;
			hasCookie.value = true;
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
	if (isSignedIn.value) {
		subscribe();
	} else {
		subscribeWithEmail();
	}
};

const toggleEmailForm = () => {
	showEmailForm.value = !showEmailForm.value;
	error.value = null;
};
</script>

<template>
	<div class="w-full">
		<!-- Error State -->
		<div
			v-if="error"
			class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
		>
			{{ error }}
		</div>

		<!-- Already Subscribed State -->
		<div
			v-if="showSuccess"
			class="flex flex-col items-center gap-3 text-green-600 dark:text-green-400 py-4"
		>
			<div class="flex items-center gap-3">
				<span class="relative flex h-3 w-3">
					<span
						class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
					></span>
					<span
						class="relative inline-flex rounded-full h-3 w-3 bg-green-500"
					></span>
				</span>
				<span class="font-medium">
					{{ isSubscribed ? "Thanks for subscribing!" : "You're subscribed!" }}
				</span>
			</div>
			<p class="text-sm text-neutral-500 dark:text-neutral-400 text-center">
				You'll receive updates about new {{ technologyName }} content.
			</p>
			<a
				v-if="isSignedIn"
				href="/settings"
				class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary underline"
			>
				Manage preferences in Settings
			</a>
		</div>

		<!-- Subscribe Form -->
		<div v-else class="space-y-4">
			<p class="text-neutral-600 dark:text-neutral-400 text-sm text-center">
				Get notified when we publish new tutorials, courses, and videos about {{ technologyName }}.
			</p>

			<!-- Signed-in user: Simple subscribe button -->
			<template v-if="isSignedIn">
				<button
					@click="subscribe"
					:disabled="isLoading"
					class="w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 text-sm"
					:class="[
						isLoading
							? 'bg-primary/10 text-primary cursor-wait'
							: 'bg-primary text-white hover:bg-primary/90'
					]"
				>
					<span class="flex items-center justify-center gap-2">
						<template v-if="isLoading">
							<span class="animate-pulse">Subscribing...</span>
						</template>
						<template v-else>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
							</svg>
							Subscribe to {{ technologyName }} Updates
						</template>
					</span>
				</button>
			</template>

			<!-- Anonymous user: Two options -->
			<template v-else>
				<div v-if="!showEmailForm" class="space-y-3">
					<a
						:href="signInUrl"
						class="w-full inline-flex items-center justify-center py-3 px-6 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all duration-300 text-sm font-medium"
					>
						Register / Sign in to subscribe
					</a>

					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-neutral-200 dark:border-neutral-700"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="px-2 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
								or
							</span>
						</div>
					</div>

					<button
						@click="toggleEmailForm"
						class="w-full py-3 px-6 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-all duration-300 text-sm"
					>
						Subscribe with email only
					</button>
				</div>

				<form v-else @submit.prevent="handleSubmit" class="space-y-3">
					<input
						v-model="email"
						type="email"
						placeholder="Enter your email address"
						required
						:disabled="isLoading"
						class="w-full py-3 px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
					/>

					<button
						type="submit"
						:disabled="isLoading || !email.trim()"
						class="w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 text-sm"
						:class="[
							isLoading
								? 'bg-primary/10 text-primary cursor-wait'
								: 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
						]"
					>
						<span class="flex items-center justify-center gap-2">
							<template v-if="isLoading">
								<span class="animate-pulse">Subscribing...</span>
							</template>
							<template v-else>Subscribe</template>
						</span>
					</button>

					<button
						type="button"
						@click="toggleEmailForm"
						class="w-full text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary transition-colors"
					>
						← Back to sign in options
					</button>
				</form>
			</template>
		</div>

		<p class="mt-4 text-xs text-neutral-500 text-center">
			No spam. Unsubscribe anytime.
		</p>
	</div>
</template>
