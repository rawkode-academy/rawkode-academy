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
		<div class="w-full">
			<!-- Success/Subscribed State -->
			<div
				v-if="showSubscribedState"
				class="flex items-center gap-2 rounded-lg bg-green-50/80 dark:bg-green-900/20 px-3 py-2 text-green-700 dark:text-green-300 text-sm"
			>
				<span class="h-2 w-2 rounded-full bg-green-500"></span>
				<span class="font-medium">{{ isSuccess ? "Subscribed!" : "You're subscribed" }}</span>
			</div>

			<!-- Main CTA for non-subscribed users -->
			<div v-else class="w-full space-y-2">
				<!-- Error State -->
				<div
					v-if="error"
					class="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs"
				>
					{{ error }}
				</div>

				<!-- Signed-in user: Simple subscribe button -->
				<template v-if="isSignedIn">
					<button
						@click="subscribeAsLearner"
						:disabled="isLoading"
						class="w-full py-2 px-4 rounded-lg border text-sm font-medium transition-colors"
						:class="[
							isLoading
								? 'bg-primary/10 border-primary/30 text-primary cursor-wait'
								: 'bg-primary text-white border-primary hover:bg-primary/90',
						]"
					>
						{{ isLoading ? "Subscribing..." : "Subscribe" }}
					</button>
				</template>

				<!-- Anonymous user -->
				<template v-else>
					<form v-if="showEmailForm" @submit.prevent="handleSubmit" class="space-y-2">
						<input
							v-model="email"
							type="email"
							placeholder="you@example.com"
							required
							:disabled="isLoading"
							class="w-full py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<button
							type="submit"
							:disabled="isLoading || !email.trim()"
							class="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
						>
							{{ isLoading ? "Subscribing..." : "Subscribe" }}
						</button>
						<button
							type="button"
							@click="toggleEmailForm"
							class="w-full text-xs text-neutral-500 hover:text-primary transition-colors"
						>
							or sign in instead
						</button>
					</form>

					<div v-else class="space-y-2">
						<button
							@click="toggleEmailForm"
							class="w-full py-2 px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-medium hover:border-primary transition-colors"
						>
							Subscribe for Updates
						</button>
						<a
							:href="signInUrl"
							class="block w-full text-center text-xs text-neutral-500 hover:text-primary transition-colors"
						>
							or sign in for more features
						</a>
					</div>
				</template>
			</div>
		</div>
	</template>
</template>
