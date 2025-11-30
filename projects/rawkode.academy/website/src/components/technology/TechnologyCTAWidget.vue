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
const activeTab = ref<"updates" | "request">("updates");

// Success states
const updatesSuccess = ref(false);
const contentRequestSuccess = ref(false);

// Cookie-based states
const hasCookieUpdates = ref(false);
const hasCookieContentRequest = ref(false);
const isSignedIn = ref(false);

/**
 * Create a source string for tracking subscriptions.
 */
function createSource(type: "updates" | "request"): string {
	return `website:technology:${props.technologyId}:${type}`;
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
 * Check for technology-specific cookies.
 */
function checkTechnologyCookies(): { updates: boolean; contentRequest: boolean } {
	try {
		const cookies = document.cookie;
		if (!cookies) return { updates: false, contentRequest: false };

		const cookiePairs = cookies.split(";");
		let updates = false;
		let contentRequest = false;

		for (const pair of cookiePairs) {
			const [name] = pair.trim().split("=");
			if (name === `${TECHNOLOGY_COOKIE_PREFIX}${props.technologyId}`) {
				updates = true;
			}
			if (name === `${TECHNOLOGY_COOKIE_PREFIX}${props.technologyId}:content`) {
				contentRequest = true;
			}
		}

		return { updates, contentRequest };
	} catch {
		return { updates: false, contentRequest: false };
	}
}

onMounted(() => {
	// Check auth state
	isSignedIn.value = checkAuthCookie();

	// Check technology-specific cookies for anonymous users
	if (!isSignedIn.value) {
		const cookieStates = checkTechnologyCookies();
		hasCookieUpdates.value = cookieStates.updates;
		hasCookieContentRequest.value = cookieStates.contentRequest;
	}
});

// Computed states
const isUpdatesSubscribed = computed(() => {
	return updatesSuccess.value || hasCookieUpdates.value;
});

const isContentRequested = computed(() => {
	return contentRequestSuccess.value || hasCookieContentRequest.value;
});

const showUpdatesSuccess = computed(() => {
	return isUpdatesSubscribed.value;
});

const showContentRequestSuccess = computed(() => {
	return isContentRequested.value;
});

// Handlers
const subscribeToUpdates = async () => {
	if (isLoading.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.subscribeToUpdates({
			technologyId: props.technologyId,
			source: createSource("updates"),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			updatesSuccess.value = true;
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

const subscribeToUpdatesWithEmail = async () => {
	if (isLoading.value || !email.value.trim()) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.subscribeToUpdatesWithEmail({
			email: email.value.trim(),
			technologyId: props.technologyId,
			source: createSource("updates"),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			updatesSuccess.value = true;
			hasCookieUpdates.value = true;
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

const requestContent = async () => {
	if (isLoading.value) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.requestContent({
			technologyId: props.technologyId,
			source: createSource("request"),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			contentRequestSuccess.value = true;
		}
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Failed to submit request. Please try again.";
	} finally {
		isLoading.value = false;
	}
};

const requestContentWithEmail = async () => {
	if (isLoading.value || !email.value.trim()) return;

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.technology.requestContentWithEmail({
			email: email.value.trim(),
			technologyId: props.technologyId,
			source: createSource("request"),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			contentRequestSuccess.value = true;
			hasCookieContentRequest.value = true;
		}
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Failed to submit request. Please try again.";
	} finally {
		isLoading.value = false;
	}
};

const handleSubmit = () => {
	if (activeTab.value === "updates") {
		if (isSignedIn.value) {
			subscribeToUpdates();
		} else {
			subscribeToUpdatesWithEmail();
		}
	} else {
		if (isSignedIn.value) {
			requestContent();
		} else {
			requestContentWithEmail();
		}
	}
};

const toggleEmailForm = () => {
	showEmailForm.value = !showEmailForm.value;
	error.value = null;
};

/**
 * Switch between tabs and reset form state
 */
const switchTab = (tab: "updates" | "request") => {
	activeTab.value = tab;
	email.value = "";
	error.value = null;
	showEmailForm.value = false;
};
</script>

<template>
	<div class="w-full">
		<!-- Tab Navigation -->
		<div class="flex border-b border-neutral-200 dark:border-neutral-700 mb-6" role="tablist">
			<button
				type="button"
				role="tab"
				:aria-selected="activeTab === 'updates'"
				aria-controls="updates-panel"
				@click="switchTab('updates')"
				:class="[
					'flex-1 py-3 px-4 text-sm font-medium transition-colors',
					activeTab === 'updates'
						? 'text-primary border-b-2 border-primary'
						: 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
				]"
			>
				Get Updates
			</button>
			<button
				type="button"
				role="tab"
				:aria-selected="activeTab === 'request'"
				aria-controls="request-panel"
				@click="switchTab('request')"
				:class="[
					'flex-1 py-3 px-4 text-sm font-medium transition-colors',
					activeTab === 'request'
						? 'text-primary border-b-2 border-primary'
						: 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
				]"
			>
				Request Content
			</button>
		</div>

		<!-- Error State -->
		<div
			v-if="error"
			class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
		>
			{{ error }}
		</div>

		<!-- Updates Tab -->
		<div v-if="activeTab === 'updates'" role="tabpanel" id="updates-panel">
			<!-- Already Subscribed State -->
			<div
				v-if="showUpdatesSuccess"
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
						{{ updatesSuccess ? "Thanks for subscribing!" : "You're subscribed!" }}
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
				<p class="text-neutral-600 dark:text-neutral-400 text-sm">
					Get notified when we publish new tutorials, courses, and videos about {{ technologyName }}.
				</p>

				<!-- Signed-in user: Simple subscribe button -->
				<template v-if="isSignedIn">
					<button
						@click="subscribeToUpdates"
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
		</div>

		<!-- Request Content Tab -->
		<div v-if="activeTab === 'request'" role="tabpanel" id="request-panel">
			<!-- Already Requested State -->
			<div
				v-if="showContentRequestSuccess"
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
						{{ contentRequestSuccess ? "Request submitted!" : "You've already requested this!" }}
					</span>
				</div>
				<p class="text-sm text-neutral-500 dark:text-neutral-400 text-center">
					We'll consider your request when planning new {{ technologyName }} content.
				</p>
			</div>

			<!-- Request Form -->
			<div v-else class="space-y-4">
				<p class="text-neutral-600 dark:text-neutral-400 text-sm">
					Want to see more {{ technologyName }} content? Let us know and we'll prioritize it in our content planning.
				</p>

				<!-- Signed-in user: Simple request button -->
				<template v-if="isSignedIn">
					<button
						@click="requestContent"
						:disabled="isLoading"
						class="w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 text-sm"
						:class="[
							isLoading
								? 'bg-secondary/10 text-secondary cursor-wait'
								: 'bg-secondary text-white hover:bg-secondary/90'
						]"
					>
						<span class="flex items-center justify-center gap-2">
							<template v-if="isLoading">
								<span class="animate-pulse">Submitting...</span>
							</template>
							<template v-else>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
								</svg>
								Request More {{ technologyName }} Content
							</template>
						</span>
					</button>
				</template>

				<!-- Anonymous user: Two options -->
				<template v-else>
					<div v-if="!showEmailForm" class="space-y-3">
						<a
							:href="signInUrl"
							class="w-full inline-flex items-center justify-center py-3 px-6 rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-all duration-300 text-sm font-medium"
						>
							Register / Sign in to request
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
							class="w-full py-3 px-6 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-secondary hover:text-secondary dark:hover:border-secondary dark:hover:text-secondary transition-all duration-300 text-sm"
						>
							Request with email only
						</button>
					</div>

					<form v-else @submit.prevent="handleSubmit" class="space-y-3">
						<input
							v-model="email"
							type="email"
							placeholder="Enter your email address"
							required
							:disabled="isLoading"
							class="w-full py-3 px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all duration-200"
						/>

						<button
							type="submit"
							:disabled="isLoading || !email.trim()"
							class="w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 text-sm"
							:class="[
								isLoading
									? 'bg-secondary/10 text-secondary cursor-wait'
									: 'bg-secondary text-white hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed'
							]"
						>
							<span class="flex items-center justify-center gap-2">
								<template v-if="isLoading">
									<span class="animate-pulse">Submitting...</span>
								</template>
								<template v-else>Submit Request</template>
							</span>
						</button>

						<button
							type="button"
							@click="toggleEmailForm"
							class="w-full text-sm text-neutral-500 dark:text-neutral-400 hover:text-secondary dark:hover:text-secondary transition-colors"
						>
							← Back to sign in options
						</button>
					</form>
				</template>
			</div>
		</div>

		<p class="mt-4 text-xs text-neutral-500 text-center">
			No spam. Unsubscribe anytime.
		</p>
	</div>
</template>
