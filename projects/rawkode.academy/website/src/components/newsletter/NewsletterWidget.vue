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

const audience = props.audience || "academy";
const NEWSLETTER_COOKIE_NAME = `newsletter:${audience}:updates`;

const email = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const isExpanded = ref(false);
const hasCookieSubscription = ref(false);
const emailInput = ref<HTMLInputElement | null>(null);

function createSource(): string {
	return `website:newsletter:${props.pagePath}`;
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
		<div class="w-full">
			<!-- Success State -->
			<Transition
				enter-active-class="transition duration-300 ease-out"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
			>
				<div
					v-if="showSubscribedState"
					class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20"
				>
					<svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm font-medium text-green-700 dark:text-green-300">
						{{ isSuccess ? "You're in!" : "Subscribed" }}
					</span>
				</div>
			</Transition>

			<!-- Main CTA -->
			<div v-if="!showSubscribedState" class="w-full">
				<!-- Error State -->
				<Transition
					enter-active-class="transition duration-200 ease-out"
					enter-from-class="opacity-0 -translate-y-1"
					enter-to-class="opacity-100 translate-y-0"
					leave-active-class="transition duration-150 ease-in"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<div
						v-if="error"
						class="mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs flex items-center gap-2"
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
						class="group w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 bg-primary text-white hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:shadow-none"
					>
						<span class="flex items-center justify-center gap-2">
							<svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
							<svg v-else class="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
							class="group w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 bg-primary text-white hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
						>
							<span class="flex items-center justify-center gap-2">
								<svg class="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Subscribe
							</span>
						</button>

						<!-- Expanded form -->
						<form v-else @submit.prevent="handleSubmit" class="space-y-2">
							<!-- Email input with integrated submit -->
							<div class="relative">
								<input
									ref="emailInput"
									v-model="email"
									type="email"
									placeholder="you@example.com"
									required
									:disabled="isLoading"
									class="w-full py-2.5 pl-4 pr-12 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm transition-all duration-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
								/>
								<button
									type="submit"
									:disabled="isLoading || !email.trim()"
									class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-white transition-all duration-200 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
									:title="isLoading ? 'Subscribing...' : 'Subscribe'"
								>
									<svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								</button>
							</div>

							<!-- Sign in option -->
							<div class="flex items-center gap-2">
								<div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
								<span class="text-xs text-neutral-400 dark:text-neutral-500">or</span>
								<div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
							</div>

							<a
								:href="signInUrl"
								class="inline-flex items-center justify-center w-full rounded-xl px-5 py-2.5 text-sm font-semibold tracking-wide text-white bg-gradient-primary shadow-lg hover:shadow-xl border border-white/40 dark:border-white/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
							>
								Continue with Sign in
							</a>
						</form>
					</Transition>
				</template>
			</div>
		</div>
	</template>
</template>
