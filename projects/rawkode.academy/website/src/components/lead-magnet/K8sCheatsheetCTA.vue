<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	isSignedIn: boolean;
	isSubscribed: boolean;
	signInUrl: string;
	pagePath: string;
}>();

const CHEATSHEET_COOKIE_NAME = "lead-magnet:k8s-1-35-cheatsheet";
const AUDIENCE = "kubernetes-release-updates";
const CHANNEL = "newsletter";

const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const hasCookieSubscription = ref(false);

function createSource(): string {
	return `website:lead-magnet:k8s-1-35:${props.pagePath}`;
}

function checkCheatsheetCookie(): boolean {
	try {
		const cookies = document.cookie;
		if (!cookies) return false;
		const cookiePairs = cookies.split(";");
		for (const pair of cookiePairs) {
			const [name, value] = pair.trim().split("=");
			if (name === CHEATSHEET_COOKIE_NAME && value === "true") {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

onMounted(() => {
	hasCookieSubscription.value = checkCheatsheetCookie();
});

const showSuccessState = computed(() => {
	return isSuccess.value || hasCookieSubscription.value;
});

const subscribeAsLearner = async () => {
	if (isLoading.value) return;
	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.newsletter.subscribe({
			audience: AUDIENCE,
			channel: CHANNEL,
			source: createSource(),
		});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) {
			isSuccess.value = true;
			// Redirect to cheatsheet page
			window.location.href = "/resources/kubernetes-1-35-cheatsheet?subscribed=1";
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
</script>

<template>
	<section class="relative overflow-hidden glass-card-shimmer p-8 md:p-12 bg-gradient-primary">
		<!-- Dark overlay for text contrast -->
		<div class="absolute inset-0 bg-black/30"></div>

		<!-- Background decoration using brand colors -->
		<div class="absolute inset-0 opacity-20">
			<div class="absolute top-0 left-0 w-72 h-72 bg-brand-secondary rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
			<div class="absolute bottom-0 right-0 w-96 h-96 bg-brand-primary rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
		</div>

		<!-- Kubernetes helm icon decoration -->
		<div class="absolute top-4 right-4 md:top-8 md:right-8 opacity-20">
			<svg class="w-24 h-24 md:w-32 md:h-32 text-white" viewBox="0 0 32 32" fill="currentColor">
				<path d="M15.9.476a2.14 2.14 0 0 0-.823.218L3.932 6.01c-.582.277-1.005.804-1.15 1.432L.054 19.373c-.13.56-.015 1.15.314 1.627l.039.048 7.64 9.814c.39.5.99.793 1.63.793h12.648a2.14 2.14 0 0 0 1.63-.793l7.64-9.814.039-.048a2.14 2.14 0 0 0 .314-1.627l-2.728-11.93a2.14 2.14 0 0 0-1.15-1.432L16.924.694A2.14 2.14 0 0 0 15.9.476Zm.1 2.96 10.947 5.207 2.592 11.342-7.253 9.315H9.715l-7.253-9.315L5.054 8.643Z"/>
				<path d="M16.002 7.27a1.07 1.07 0 0 0-.424.096c-.152.065-.296.168-.424.319-.476.558-.588 1.608-.283 2.8a9.2 9.2 0 0 0-3.202 1.837c-.924-.596-1.867-.856-2.57-.639-.238.074-.432.198-.58.374-.15.176-.245.412-.26.68-.059.992.7 2.242 1.99 3.287a9.2 9.2 0 0 0-.093 3.694c-1.131.638-1.91 1.478-2.084 2.381-.06.306-.036.6.068.877.104.277.299.518.583.709.767.515 1.934.52 3.162.063a9.2 9.2 0 0 0 2.529 2.711c-.294 1.137-.256 2.135.15 2.715.138.197.318.34.538.427.22.086.483.105.753.05.98-.2 2.038-1.006 2.811-2.2a9.2 9.2 0 0 0 3.548.041c.759 1.213 1.808 2.039 2.794 2.256.27.06.534.043.756-.042.221-.084.403-.225.542-.42.41-.576.458-1.574.17-2.72a9.2 9.2 0 0 0 2.521-2.682c1.216.458 2.377.46 3.147-.044.286-.188.483-.427.588-.702.105-.275.13-.567.072-.871-.17-.896-.94-1.729-2.052-2.368a9.2 9.2 0 0 0-.088-3.723c1.294-1.04 2.06-2.282 2.008-3.272-.014-.266-.107-.5-.255-.675a1.07 1.07 0 0 0-.576-.38c-.705-.222-1.654.033-2.587.625a9.2 9.2 0 0 0-3.186-1.849c.3-1.185.19-2.229-.282-2.788a1.07 1.07 0 0 0-.424-.32c-.152-.068-.323-.095-.5-.086-.978.049-1.939 1.043-2.568 2.593a9.2 9.2 0 0 0-3.534-.012c-.622-1.57-1.58-2.586-2.567-2.649a1.07 1.07 0 0 0-.076-.003Z"/>
			</svg>
		</div>

		<div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
			<!-- Content -->
			<div class="flex-1 max-w-2xl">
				<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium mb-4">
					<span class="relative flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-brand-secondary"></span>
					</span>
					Release: December 17, 2025
				</div>

				<h2 class="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 font-display">
					Kubernetes 1.35 Cheat Sheet
				</h2>

				<p class="text-lg text-white/90 mb-6">
					The release that changes everything: mandatory cgroup v2 enforcement, AI/ML scheduler primitives,
					and structured authentication going GA. Don't get caught off-guard.
				</p>

				<!-- Feature highlights with category icons -->
				<ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
					<!-- Breaking Changes (red warning) -->
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<span><strong class="text-red-300">cgroup v2 mandatory</strong> - kubelet fails on v1</span>
					</li>
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<span><strong class="text-red-300">containerd 2.0</strong> - last v1.x support</span>
					</li>
					<!-- GA Features (green checkmark) -->
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span><strong class="text-green-300">In-place scaling</strong> - resize without restarts</span>
					</li>
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span><strong class="text-green-300">Structured auth</strong> - hot-swap OIDC</span>
					</li>
					<!-- AI/ML (purple chip) -->
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
						</svg>
						<span><strong class="text-purple-300">Gang scheduling</strong> - all-or-nothing pods</span>
					</li>
					<!-- Security (blue shield) -->
					<li class="flex items-center gap-2 text-white/90">
						<svg class="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
						<span><strong class="text-blue-300">User namespaces</strong> - root in container only</span>
					</li>
				</ul>
			</div>

			<!-- Form -->
			<div class="w-full lg:w-auto lg:min-w-[340px]">
				<div class="glass-card card-padding">
					<!-- Success State -->
					<Transition
						enter-active-class="transition duration-300 ease-out"
						enter-from-class="opacity-0 scale-95"
						enter-to-class="opacity-100 scale-100"
					>
						<div
							v-if="showSuccessState"
							class="text-center py-4"
						>
							<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-secondary/20 flex items-center justify-center">
								<svg class="w-8 h-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 class="text-lg font-semibold text-primary-content mb-2 font-display">You're on the list!</h3>
							<p class="text-sm text-secondary-content">
								Redirecting to your cheatsheet...
							</p>
						</div>
					</Transition>

					<!-- Form -->
					<div v-if="!showSuccessState">
						<h3 class="text-lg font-semibold text-primary-content mb-2 font-display">
							Get the free cheat sheet
						</h3>
						<p class="text-sm text-secondary-content mb-4">
							Join 30K+ cloud native engineers
						</p>

						<!-- Error State -->
						<Transition
							enter-active-class="transition duration-200 ease-out"
							enter-from-class="opacity-0 -translate-y-1"
							enter-to-class="opacity-100 translate-y-0"
						>
							<div
								v-if="error"
								class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm"
							>
								{{ error }}
							</div>
						</Transition>

						<!-- Signed-in user -->
						<template v-if="isSignedIn">
							<button
								@click="subscribeAsLearner"
								:disabled="isLoading"
								class="btn-solid w-full py-3 px-4 text-base font-semibold shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-wait"
							>
								<span class="flex items-center justify-center gap-2">
									<svg v-if="isLoading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									{{ isLoading ? "Please wait..." : "Download Free Cheat Sheet" }}
								</span>
							</button>
						</template>

						<!-- Anonymous user - must sign in to access -->
						<template v-else>
							<div class="space-y-4">
								<p class="text-sm text-secondary-content">
									Sign in with GitHub to get instant access to the cheat sheet and join 30K+ cloud native engineers.
								</p>
								<a
									:href="signInUrl"
									class="btn-solid flex items-center justify-center w-full py-3 px-4 text-base font-semibold shadow-lg hover:shadow-xl"
								>
									<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
										<path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
									</svg>
									Sign in with GitHub
								</a>
							</div>
						</template>

						<p class="mt-4 text-xs text-center text-muted">
							No spam. Unsubscribe anytime.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
