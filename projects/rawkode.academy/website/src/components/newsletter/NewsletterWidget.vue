<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isSubscribed: boolean;
	signInUrl: string;
}>();

const NEWSLETTER_COOKIE_NAME = "ra_newsletter_subscribed";

const email = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const showEmailForm = ref(false);
const hasCookieSubscription = ref(false);

// Check for newsletter cookie on mount (client-side only)
onMounted(() => {
	if (!props.isSignedIn) {
		hasCookieSubscription.value = document.cookie
			.split("; ")
			.some((row) => row.startsWith(`${NEWSLETTER_COOKIE_NAME}=true`));
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
			source: "website-cta",
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
				source: "website-cta-anonymous",
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
		<!-- Success/Subscribed State -->
		<div
			v-if="showSubscribedState"
			class="flex flex-col items-center gap-3 text-green-600 dark:text-green-400"
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
					{{ isSuccess ? "Thanks for subscribing!" : "You're subscribed!" }}
				</span>
			</div>
			<a
				v-if="isSignedIn"
				href="/settings"
				class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary underline"
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

			<!-- Signed-in user: Simple subscribe button -->
			<template v-if="isSignedIn">
				<button
					@click="subscribeAsLearner"
					:disabled="isLoading"
					class="w-full relative overflow-hidden py-3 px-6 rounded border transition-all duration-300 text-sm min-w-[200px]"
					:class="[
						isLoading
							? 'bg-primary/10 border-primary/30 text-primary cursor-wait'
							: 'bg-white/5 dark:bg-white/5 hover:bg-primary hover:border-primary border-white/20 dark:border-white/10 text-gray-900 dark:text-white hover:text-white hover:shadow-[0_0_20px_rgba(var(--brand-primary),0.4)]',
					]"
				>
					<span class="relative z-10 flex items-center justify-center gap-3">
						<template v-if="isLoading">
							<span class="animate-pulse">Subscribing...</span>
						</template>
						<template v-else>
							<span>Subscribe for Updates!</span>
						</template>
					</span>
				</button>
			</template>

			<!-- Anonymous user: Two options -->
			<template v-else>
				<!-- Option 1: Sign in to subscribe -->
				<div v-if="!showEmailForm" class="space-y-3">
					<a
						:href="signInUrl"
						class="w-full inline-flex items-center justify-center py-3 px-6 rounded border bg-primary text-white hover:bg-primary/90 transition-all duration-300 text-sm font-medium"
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
						class="w-full py-3 px-6 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-all duration-300 text-sm"
					>
						Sign up with email only
					</button>
				</div>

				<!-- Option 2: Email form -->
				<form v-else @submit.prevent="handleSubmit" class="space-y-3">
					<div class="relative">
						<input
							v-model="email"
							type="email"
							placeholder="Enter your email address"
							required
							:disabled="isLoading"
							class="w-full py-3 px-4 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
						/>
					</div>

					<button
						type="submit"
						:disabled="isLoading || !email.trim()"
						class="w-full py-3 px-6 rounded border transition-all duration-300 text-sm font-medium"
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
						class="w-full text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary transition-colors"
					>
						← Back to sign in options
					</button>
				</form>
			</template>

			<p class="text-sm text-neutral-500 text-center">
				No spam. Unsubscribe anytime.
			</p>
		</div>
	</template>
</template>
