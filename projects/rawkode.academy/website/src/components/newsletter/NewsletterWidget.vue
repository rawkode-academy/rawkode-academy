<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isSubscribed: boolean;
	signInUrl: string;
	pagePath: string;
}>();

const NEWSLETTER_COOKIE_NAME = "newsletter:academy:updates";

const email = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const showEmailForm = ref(false);
const hasCookieSubscription = ref(false);

/**
 * Create a source string for tracking newsletter subscriptions.
 * Format: website:newsletter:{pagePath} where pagePath is the current page pathname
 * Examples: website:newsletter:/ or website:newsletter:/watch/slug
 */
function createSource(): string {
	return `website:newsletter:${props.pagePath}`;
}

/**
 * Safely check if the newsletter subscription cookie is present.
 * Uses try-catch to handle any edge cases with cookie parsing.
 */
function checkNewsletterCookie(): boolean {
	try {
		const cookies = document.cookie;
		if (!cookies) return false;

		// Parse cookies safely
		const cookiePairs = cookies.split(";");
		for (const pair of cookiePairs) {
			const [name, value] = pair.trim().split("=");
			if (name === NEWSLETTER_COOKIE_NAME && value === "true") {
				return true;
			}
		}
		return false;
	} catch {
		// If any error occurs during cookie parsing, assume not subscribed
		return false;
	}
}

// Check for newsletter cookie on mount (client-side only)
onMounted(() => {
	if (!props.isSignedIn) {
		hasCookieSubscription.value = checkNewsletterCookie();
	}
});

// Compute whether to hide the entire widget
const shouldHide = computed(() => {
	// If signed in and subscribed, show a discrete message instead
	if (props.isSignedIn && props.isSubscribed) {
		return false; // Will show subscribed state
	}
	// For anonymous users with the cookie, hide completely
	if (!props.isSignedIn && hasCookieSubscription.value) {
		return true;
	}
	// If successfully subscribed in this session, hide (after showing success)
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
			source: createSource(),
		});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			isSuccess.value = true;
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
		const { data, error: actionError } =
			await actions.newsletter.subscribeWithEmail({
				email: email.value.trim(),
				source: createSource(),
			});

		if (actionError) {
			throw new Error(actionError.message);
		}

		if (data?.success) {
			isSuccess.value = true;
			// Cookie is set by the server action, but we update local state
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

const toggleEmailForm = () => {
	showEmailForm.value = !showEmailForm.value;
	error.value = null;
};
</script>

<template>
	<!-- Hide widget entirely for anonymous users with cookie -->
        <template v-if="!shouldHide">
                <div class="w-full rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xl p-5 sm:p-6 space-y-5">
                        <!-- Success/Subscribed State -->
                        <div
                                v-if="showSubscribedState"
                                class="flex flex-col items-center gap-4 rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/70 dark:bg-green-900/20 px-4 py-5 text-green-700 dark:text-green-300 text-center"
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
                                        <span class="font-semibold">
                                                {{ isSuccess ? "Thanks for subscribing!" : "You're subscribed!" }}
                                        </span>
                                </div>
                                <p class="text-sm text-green-700/90 dark:text-green-200">Expect your next issue soon.</p>
                                <a
                                        v-if="isSignedIn"
                                        href="/settings"
                                        class="text-sm font-medium text-green-700 dark:text-green-200 hover:text-primary dark:hover:text-primary underline"
                                >
                                        Manage your email preferences in Settings
                                </a>
                        </div>

                        <!-- Main CTA for non-subscribed users -->
                        <div v-else class="w-full space-y-4">
                                <!-- Error State -->
                                <div
                                        v-if="error"
                                        class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
                                >
                                        {{ error }}
                                </div>

                                <div class="flex items-start justify-between gap-4">
                                        <div class="space-y-1">
                                                <p class="text-xs uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">Choose your path</p>
                                                <p class="text-lg font-semibold text-neutral-900 dark:text-white">Sign in or subscribe with email</p>
                                        </div>
                                        <span class="hidden sm:inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">5 min read per week</span>
                                </div>

                                <!-- Signed-in user: Simple subscribe button -->
                                <template v-if="isSignedIn">
                                        <button
                                                @click="subscribeAsLearner"
                                                :disabled="isLoading"
                                                class="w-full relative overflow-hidden py-3 px-6 rounded-xl border transition-all duration-300 text-sm min-w-[200px] shadow-sm"
                                                :class="[
                                                        isLoading
                                                                ? 'bg-primary/10 border-primary/30 text-primary cursor-wait'
                                                                : 'bg-white dark:bg-neutral-900 hover:bg-primary hover:border-primary border-neutral-200 dark:border-neutral-700 text-gray-900 dark:text-white hover:text-white hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]',
                                                ]"
                                        >
                                                <span class="relative z-10 flex items-center justify-center gap-3">
                                                        <template v-if="isLoading">
                                                                <span class="animate-pulse">Subscribing...</span>
                                                        </template>
                                                        <template v-else>
                                                                <span>Subscribe for Updates</span>
                                                        </template>
                                                </span>
                                        </button>
                                </template>

                                <!-- Anonymous user: Two options -->
                                <template v-else>
                                        <!-- Option 1: Sign in to subscribe -->
                                        <div v-if="!showEmailForm" class="space-y-4">
                                                <a
                                                        :href="signInUrl"
                                                        class="w-full inline-flex items-center justify-center py-3 px-6 rounded-xl border border-primary/80 bg-primary text-white hover:bg-primary/90 transition-all duration-300 text-sm font-semibold shadow-sm"
                                                >
                                                        Register / Sign in to get updates
                                                </a>

                                                <div class="relative">
                                                        <div class="absolute inset-0 flex items-center">
                                                                <div
                                                                        class="w-full border-t border-neutral-200 dark:border-neutral-700"
                                                                ></div>
                                                        </div>
                                                        <div class="relative flex justify-center text-sm">
                                                                <span
                                                                        class="px-2 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400"
                                                                >
                                                                        or
                                                                </span>
                                                        </div>
                                                </div>

                                                <button
                                                        @click="toggleEmailForm"
                                                        class="w-full py-3 px-6 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-all duration-300 text-sm font-medium bg-neutral-50 dark:bg-neutral-800/70 shadow-sm"
                                                >
                                                        Sign up with email only
                                                </button>
                                        </div>

                                        <!-- Option 2: Email form -->
                                        <form v-else @submit.prevent="handleSubmit" class="space-y-3">
                                                <div class="relative">
                                                        <label class="block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400 mb-2">Email address</label>
                                                        <input
                                                                v-model="email"
                                                                type="email"
                                                                placeholder="you@example.com"
                                                                required
                                                                :disabled="isLoading"
                                                                class="w-full py-3 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 shadow-sm"
                                                        />
                                                </div>

                                                <button
                                                        type="submit"
                                                        :disabled="isLoading || !email.trim()"
                                                        class="w-full py-3 px-6 rounded-xl border transition-all duration-300 text-sm font-semibold shadow-sm"
                                                        :class="[
                                                                isLoading
                                                                        ? 'bg-primary/10 border-primary/30 text-primary cursor-wait'
                                                                        : 'bg-primary text-white border-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
                                                        ]"
                                                >
                                                        <span class="flex items-center justify-center gap-2">
                                                                <template v-if="isLoading">
                                                                        <span class="animate-pulse">Subscribing...</span>
                                                                </template>
                                                                <template v-else> Subscribe </template>
                                                        </span>
                                                </button>

                                                <button
                                                        type="button"
                                                        @click="toggleEmailForm"
                                                        class="w-full text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-primary transition-colors"
                                                >
                                                        ← Back to sign in options
                                                </button>
                                        </form>
                                </template>

                                <p class="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                                        No spam. Unsubscribe anytime.
                                </p>
                        </div>
                </div>
        </template>
</template>
