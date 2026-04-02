<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";
import Card from "@/components/ui/Card.vue";
import { css } from "../../../styled-system/css";
import {
	getSessionCampaignAttribution,
	serializeCampaignAttribution,
} from "@/lib/analytics/attribution";
import {
	GROWTH_EVENTS,
	captureGrowthClientEvent,
} from "@/lib/analytics/growth";

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
const hasCookieSubscription = ref(props.isSubscribed);

// Expandable features state
const expandedFeatures = ref<Set<string>>(new Set());

interface Feature {
	id: string;
	category: "breaking" | "ga" | "aiml" | "security";
	title: string;
	subtitle: string;
	detail: string;
}

const categoryConfig = {
	breaking: {
		label: "Breaking",
		bgStyle: css({ bg: "amber.500" }),
	},
	ga: {
		label: "GA",
		bgStyle: css({ bg: "emerald.500" }),
	},
	aiml: {
		label: "AI/ML",
		bgStyle: css({ bg: "violet.500" }),
	},
	security: {
		label: "Security",
		bgStyle: css({ bg: "sky.500" }),
	},
};

const features: Feature[] = [
	{
		id: "cgroup-v2",
		category: "breaking",
		title: "cgroup v2 mandatory",
		subtitle: "kubelet fails on v1",
		detail:
			"Starting in 1.35, kubelet will fail to start on nodes running cgroup v1. Ensure all nodes are migrated before upgrading.",
	},
	{
		id: "containerd",
		category: "breaking",
		title: "containerd 2.0",
		subtitle: "last v1.x support",
		detail:
			"This is the last release supporting containerd 1.x. Plan your container runtime upgrade path now.",
	},
	{
		id: "in-place-scaling",
		category: "ga",
		title: "In-place scaling",
		subtitle: "resize without restarts",
		detail:
			"Pods can now have their CPU/memory requests and limits changed without restart. Enabled by default.",
	},
	{
		id: "structured-auth",
		category: "ga",
		title: "Structured auth",
		subtitle: "hot-swap OIDC",
		detail:
			"Hot-swap OIDC providers without API server restart. Configure multiple identity providers simultaneously.",
	},
	{
		id: "gang-scheduling",
		category: "aiml",
		title: "Gang scheduling",
		subtitle: "all-or-nothing pods",
		detail:
			"Schedule pod groups atomically - all pods start together or none do. Essential for distributed ML training.",
	},
	{
		id: "user-namespaces",
		category: "security",
		title: "User namespaces",
		subtitle: "root in container only",
		detail:
			"Pods run as root inside container but unprivileged on host. Major security improvement for multi-tenant clusters.",
	},
];

function toggleFeature(id: string) {
	if (expandedFeatures.value.has(id)) {
		expandedFeatures.value.delete(id);
	} else {
		expandedFeatures.value.add(id);
	}
	// Trigger reactivity
	expandedFeatures.value = new Set(expandedFeatures.value);
}

function isExpanded(id: string): boolean {
	return expandedFeatures.value.has(id);
}

function createSource(): string {
	return `website:lead-magnet:k8s-1-35:${props.pagePath}`;
}

function createAttributionPayload(): string | undefined {
	return serializeCampaignAttribution(getSessionCampaignAttribution());
}

function getBaseGrowthProperties(
	method?: "learner" | "sign_in" | "view_asset",
): Record<string, unknown> {
	return {
		lead_magnet: "k8s-1-35-cheatsheet",
		audience: AUDIENCE,
		channel: CHANNEL,
		page_path: props.pagePath,
		source: createSource(),
		is_authenticated: props.isSignedIn,
		already_subscribed: hasCookieSubscription.value,
		...(method ? { method } : {}),
	};
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
	hasCookieSubscription.value =
		hasCookieSubscription.value || checkCheatsheetCookie();

	captureGrowthClientEvent(
		GROWTH_EVENTS.LEAD_MAGNET_VIEWED,
		getBaseGrowthProperties(),
	);
});

const showSuccessState = computed(() => {
	return isSuccess.value || hasCookieSubscription.value;
});

const trackSignInClick = () => {
	captureGrowthClientEvent(
		GROWTH_EVENTS.LEAD_MAGNET_CLICKED,
		getBaseGrowthProperties("sign_in"),
	);
};

const trackViewAssetClick = () => {
	captureGrowthClientEvent(
		GROWTH_EVENTS.LEAD_MAGNET_CLICKED,
		getBaseGrowthProperties("view_asset"),
	);
};

const subscribeAsLearner = async () => {
	if (isLoading.value) return;

	captureGrowthClientEvent(
		GROWTH_EVENTS.LEAD_MAGNET_CLICKED,
		getBaseGrowthProperties("learner"),
	);
	captureGrowthClientEvent(
		GROWTH_EVENTS.LEAD_MAGNET_SUBMISSION_ATTEMPTED,
		getBaseGrowthProperties("learner"),
	);

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.newsletter.subscribe({
			audience: AUDIENCE,
			channel: CHANNEL,
			source: createSource(),
			attribution: createAttributionPayload(),
		});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) {
			isSuccess.value = true;
			captureGrowthClientEvent(
				GROWTH_EVENTS.LEAD_MAGNET_SIGNUP,
				getBaseGrowthProperties("learner"),
			);
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

const btnSolidStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	borderRadius: "xl",
	bg: "rgb(var(--brand-primary))",
	color: "white",
	fontWeight: "semibold",
	transition: "all",
	transitionDuration: "200ms",
	_hover: { opacity: "0.9", shadow: "xl" },
});
</script>

<template>
	<section :class="css({ position: 'relative', overflow: 'hidden', p: { base: '4', sm: '6', md: '8', lg: '12' }, background: 'linear-gradient(135deg, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))', borderRadius: { base: 'xl', sm: '2xl' } })">
		<!-- Dark overlay for text contrast -->
		<div :class="css({ position: 'absolute', inset: '0', bg: 'black/30' })"></div>

		<!-- Background decoration using brand colors -->
		<div :class="css({ position: 'absolute', inset: '0', opacity: '0.2' })">
			<div :class="css({ position: 'absolute', top: '0', left: '0', w: '72', h: '72', bg: 'rgb(var(--brand-secondary))', borderRadius: 'full', filter: 'blur(48px)', transform: 'translate(-50%, -50%)' })"></div>
			<div :class="css({ position: 'absolute', bottom: '0', right: '0', w: '96', h: '96', bg: 'rgb(var(--brand-primary))', borderRadius: 'full', filter: 'blur(48px)', transform: 'translate(33%, 33%)' })"></div>
		</div>

		<!-- Kubernetes helm icon decoration with slow rotation -->
		<div :class="css({ position: 'absolute', top: { base: '2', sm: '4', md: '8' }, right: { base: '2', sm: '4', md: '8' }, opacity: '0.2', animation: 'spin 20s linear infinite' })">
			<svg :class="css({ w: { base: '14', sm: '20', md: '24', lg: '32' }, h: { base: '14', sm: '20', md: '24', lg: '32' }, color: 'white' })" viewBox="0 0 32 32" fill="currentColor">
				<path d="M15.9.476a2.14 2.14 0 0 0-.823.218L3.932 6.01c-.582.277-1.005.804-1.15 1.432L.054 19.373c-.13.56-.015 1.15.314 1.627l.039.048 7.64 9.814c.39.5.99.793 1.63.793h12.648a2.14 2.14 0 0 0 1.63-.793l7.64-9.814.039-.048a2.14 2.14 0 0 0 .314-1.627l-2.728-11.93a2.14 2.14 0 0 0-1.15-1.432L16.924.694A2.14 2.14 0 0 0 15.9.476Zm.1 2.96 10.947 5.207 2.592 11.342-7.253 9.315H9.715l-7.253-9.315L5.054 8.643Z"/>
				<path d="M16.002 7.27a1.07 1.07 0 0 0-.424.096c-.152.065-.296.168-.424.319-.476.558-.588 1.608-.283 2.8a9.2 9.2 0 0 0-3.202 1.837c-.924-.596-1.867-.856-2.57-.639-.238.074-.432.198-.58.374-.15.176-.245.412-.26.68-.059.992.7 2.242 1.99 3.287a9.2 9.2 0 0 0-.093 3.694c-1.131.638-1.91 1.478-2.084 2.381-.06.306-.036.6.068.877.104.277.299.518.583.709.767.515 1.934.52 3.162.063a9.2 9.2 0 0 0 2.529 2.711c-.294 1.137-.256 2.135.15 2.715.138.197.318.34.538.427.22.086.483.105.753.05.98-.2 2.038-1.006 2.811-2.2a9.2 9.2 0 0 0 3.548.041c.759 1.213 1.808 2.039 2.794 2.256.27.06.534.043.756-.042.221-.084.403-.225.542-.42.41-.576.458-1.574.17-2.72a9.2 9.2 0 0 0 2.521-2.682c1.216.458 2.377.46 3.147-.044.286-.188.483-.427.588-.702.105-.275.13-.567.072-.871-.17-.896-.94-1.729-2.052-2.368a9.2 9.2 0 0 0-.088-3.723c1.294-1.04 2.06-2.282 2.008-3.272-.014-.266-.107-.5-.255-.675a1.07 1.07 0 0 0-.576-.38c-.705-.222-1.654.033-2.587.625a9.2 9.2 0 0 0-3.186-1.849c.3-1.185.19-2.229-.282-2.788a1.07 1.07 0 0 0-.424-.32c-.152-.068-.323-.095-.5-.086-.978.049-1.939 1.043-2.568 2.593a9.2 9.2 0 0 0-3.534-.012c-.622-1.57-1.58-2.586-2.567-2.649a1.07 1.07 0 0 0-.076-.003Z"/>
			</svg>
		</div>

		<div :class="css({ position: 'relative', zIndex: '10', display: 'flex', flexDir: { base: 'column', lg: 'row' }, lg: { alignItems: 'flex-start', justifyContent: 'space-between' }, gap: { base: '6', sm: '8' } })">
			<!-- Content -->
			<div :class="css({ flex: '1', maxW: '2xl' })">
				<div :class="css({ display: 'inline-flex', alignItems: 'center', gap: '2', px: { base: '2.5', sm: '3' }, py: { base: '1', sm: '1.5' }, borderRadius: 'full', bg: 'black/30', color: 'white', fontSize: { base: 'xs', sm: 'sm' }, fontWeight: 'medium', mb: { base: '3', sm: '4' } })">
					<span :class="css({ position: 'relative', display: 'flex', h: '2', w: '2' })">
						<span :class="css({ animation: 'ping', position: 'absolute', display: 'inline-flex', h: 'full', w: 'full', borderRadius: 'full', bg: 'emerald.400', opacity: '0.75' })"></span>
						<span :class="css({ position: 'relative', display: 'inline-flex', borderRadius: 'full', h: '2', w: '2', bg: 'emerald.400' })"></span>
					</span>
					Release: December 17, 2025
				</div>

				<h2 :class="css({ fontSize: { base: 'xl', sm: '2xl', md: '3xl', lg: '4xl' }, fontWeight: 'bold', color: 'white', mb: { base: '3', sm: '4' }, fontFamily: 'display', pr: { base: '12', sm: '0' } })">
					Kubernetes 1.35 Cheat Sheet
				</h2>

				<p :class="css({ fontSize: { base: 'sm', sm: 'base', md: 'lg' }, color: 'white/90', mb: { base: '5', sm: '6' } })">
					Your comprehensive guide to 1.35: mandatory cgroup v2, AI/ML scheduler primitives,
					and structured authentication going GA. Everything you need in one place.
				</p>

				<!-- Expandable Feature highlights -->
				<div :class="css({ display: 'grid', gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)' }, gap: '2', mb: { base: '5', sm: '6', lg: '0' } })">
					<button
						v-for="feature in features"
						:key="feature.id"
						@click="toggleFeature(feature.id)"
						:aria-expanded="isExpanded(feature.id)"
						:class="css({ textAlign: 'left', borderRadius: 'lg', p: { base: '2.5', sm: '3' }, transition: 'all', transitionDuration: '200ms', bg: 'black/20', cursor: 'pointer', _hover: { bg: 'black/30' }, _focus: { outline: 'none', ring: '2px solid rgba(255,255,255,0.3)' } })"
					>
						<div :class="css({ display: 'flex', alignItems: 'flex-start', gap: { base: '2', sm: '3' } })">
							<!-- Category pill -->
							<span
								:class="[
									css({ display: 'inline-flex', alignItems: 'center', px: { base: '1.5', sm: '2' }, py: '0.5', borderRadius: 'sm', fontSize: { base: '2.5', sm: 'xs' }, fontWeight: 'semibold', color: 'white', flexShrink: '0', mt: '0.5' }),
									categoryConfig[feature.category].bgStyle
								]"
							>
								{{ categoryConfig[feature.category].label }}
							</span>

							<div :class="css({ flex: '1', minW: '0' })">
								<div :class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: { base: '1.5', sm: '2' } })">
									<span :class="css({ color: 'white', fontWeight: 'medium', fontSize: { base: 'xs', sm: 'sm', md: 'base' }, lineHeight: 'tight' })">
										{{ feature.title }}
									</span>
									<svg
										:class="[
											css({ w: { base: '3.5', sm: '4' }, h: { base: '3.5', sm: '4' }, color: 'white/60', transition: 'transform', transitionDuration: '200ms', flexShrink: '0' }),
											isExpanded(feature.id) ? css({ transform: 'rotate(180deg)' }) : ''
										]"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
								<span :class="css({ color: 'white/70', fontSize: { base: 'xs', sm: 'sm' } })">{{ feature.subtitle }}</span>

								<!-- Expandable detail -->
								<Transition
									enter-active-class="transition-all duration-200 ease-out"
									enter-from-class="opacity-0 max-h-0"
									enter-to-class="opacity-100 max-h-24"
									leave-active-class="transition-all duration-150 ease-in"
									leave-from-class="opacity-100 max-h-24"
									leave-to-class="opacity-0 max-h-0"
								>
									<p
										v-if="isExpanded(feature.id)"
										:class="css({ mt: { base: '1.5', sm: '2' }, fontSize: { base: 'xs', sm: 'sm' }, color: 'white/80', lineHeight: 'relaxed', overflow: 'hidden' })"
									>
										{{ feature.detail }}
									</p>
								</Transition>
							</div>
						</div>
					</button>
				</div>
			</div>

			<!-- Form Card -->
			<div :class="css({ w: { base: 'full', lg: 'auto' }, lg: { minW: '280px', maxW: '380px' } })">
				<Card
					variant="glass"
					padding="md"
					rounded="xl"
					shadow="elevated"
					:hover="false"
					:class="css({ ring: '1px solid rgba(255,255,255,0.1)' })"
				>
					<!-- Success State -->
					<Transition
						enter-active-class="transition duration-300 ease-out"
						enter-from-class="opacity-0 scale-95"
						enter-to-class="opacity-100 scale-100"
					>
						<div
							v-if="showSuccessState"
							:class="css({ textAlign: 'center', py: { base: '1', sm: '2' } })"
						>
							<div :class="css({ w: { base: '12', sm: '16' }, h: { base: '12', sm: '16' }, mx: 'auto', mb: { base: '3', sm: '4' }, borderRadius: 'full', bg: 'green.500/20', display: 'flex', alignItems: 'center', justifyContent: 'center' })">
								<svg :class="css({ w: { base: '6', sm: '8' }, h: { base: '6', sm: '8' }, color: 'green.400' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 :class="css({ fontSize: { base: 'lg', sm: 'xl' }, fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' }, mb: '2', fontFamily: 'display' })">You're on the list!</h3>
							<p :class="css({ fontSize: { base: 'xs', sm: 'sm' }, color: { base: 'gray.700', _dark: 'gray.300' }, mb: { base: '4', sm: '6' } })">
								Your cheat sheet is ready. Click below to view it now.
							</p>
							<a
								href="/resources/kubernetes/1.35-cheatsheet"
								@click="trackViewAssetClick"
								:class="[btnSolidStyle, css({ w: 'full', py: { base: '2.5', sm: '3' }, px: '4', fontSize: { base: 'sm', sm: 'base' }, shadow: 'lg' })]"
							>
								<svg :class="css({ w: { base: '4', sm: '5' }, h: { base: '4', sm: '5' }, mr: '2' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								View Cheat Sheet
							</a>
						</div>
					</Transition>

					<!-- Form -->
					<div v-if="!showSuccessState">
						<h3 :class="css({ fontSize: { base: 'base', sm: 'lg' }, fontWeight: 'semibold', color: { base: 'gray.900', _dark: 'white' }, mb: { base: '1.5', sm: '2' }, fontFamily: 'display' })">
							Get the free cheat sheet
						</h3>
						<p :class="css({ fontSize: { base: 'xs', sm: 'sm' }, color: { base: 'gray.700', _dark: 'gray.300' }, mb: { base: '3', sm: '4' } })">
							Trusted by 30K+ cloud native engineers
						</p>

						<!-- Error State -->
						<Transition
							enter-active-class="transition duration-200 ease-out"
							enter-from-class="opacity-0 -translate-y-1"
							enter-to-class="opacity-100 translate-y-0"
						>
							<div
								v-if="error"
								:class="css({ mb: { base: '3', sm: '4' }, p: { base: '2.5', sm: '3' }, borderRadius: 'lg', bg: { base: 'red.50', _dark: 'red.900/20' }, border: '1px solid', borderColor: { base: 'red.200', _dark: 'red.800/50' } })"
							>
								<p :class="css({ color: { base: 'red.600', _dark: 'red.400' }, fontSize: { base: 'xs', sm: 'sm' }, mb: { base: '1.5', sm: '2' } })">{{ error }}</p>
								<button
									@click="subscribeAsLearner"
									:class="css({ fontSize: { base: 'xs', sm: 'sm' }, fontWeight: 'medium', color: { base: 'red.700', _dark: 'red.300' }, _hover: { textDecoration: 'underline' } })"
								>
									Try again
								</button>
							</div>
						</Transition>

						<!-- Signed-in user -->
						<template v-if="isSignedIn">
							<button
								@click="subscribeAsLearner"
								:disabled="isLoading"
								:class="[btnSolidStyle, css({ w: 'full', py: { base: '2.5', sm: '3' }, px: '4', fontSize: { base: 'sm', sm: 'base' }, shadow: 'lg', minH: { base: '44px', sm: '48px' }, _disabled: { opacity: '0.7', cursor: 'wait' } })]"
							>
								<span :class="css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2' })">
									<svg v-if="isLoading" :class="css({ w: { base: '4', sm: '5' }, h: { base: '4', sm: '5' }, animation: 'spin' })" fill="none" viewBox="0 0 24 24">
										<circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else :class="css({ w: { base: '4', sm: '5' }, h: { base: '4', sm: '5' } })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									{{ isLoading ? "Please wait..." : "Get the Free Cheat Sheet" }}
								</span>
							</button>
						</template>

						<!-- Anonymous user - must sign in to access -->
						<template v-else>
							<div :class="css({ display: 'flex', flexDir: 'column', gap: { base: '3', sm: '4' } })">
								<p :class="css({ fontSize: { base: 'xs', sm: 'sm' }, color: { base: 'gray.700', _dark: 'gray.300' } })">
									Sign in with GitHub to get instant access to the cheat sheet.
								</p>
								<a
									:href="signInUrl"
									@click="trackSignInClick"
									:class="[btnSolidStyle, css({ w: 'full', py: { base: '2.5', sm: '3' }, px: '4', fontSize: { base: 'sm', sm: 'base' }, shadow: 'lg', minH: { base: '44px', sm: '48px' } })]"
								>
									<svg :class="css({ w: { base: '4', sm: '5' }, h: { base: '4', sm: '5' }, mr: '2' })" fill="currentColor" viewBox="0 0 24 24">
										<path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
									</svg>
									Sign in with GitHub
								</a>
							</div>
						</template>

						<p :class="css({ mt: { base: '3', sm: '4' }, fontSize: { base: '2.5', sm: 'xs' }, textAlign: 'center', color: { base: 'gray.600', _dark: 'gray.400' } })">
							No spam. Unsubscribe anytime.
						</p>
					</div>
				</Card>
			</div>
		</div>
	</section>
</template>
