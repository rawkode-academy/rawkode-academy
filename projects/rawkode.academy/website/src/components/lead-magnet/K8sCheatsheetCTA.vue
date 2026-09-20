<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { actions } from "astro:actions";
import { Accordion } from "@ark-ui/vue/accordion";
import { academyReference, academyLayout, academyAccount } from "@rawkodeacademy/design-system";
const s = academyReference();
const layout = academyLayout();
const account = academyAccount();
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
	},
	ga: {
		label: "GA",
	},
	aiml: {
		label: "AI/ML",
	},
	security: {
		label: "Security",
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
</script>

<template>
	<section :class="s.panel" aria-label="Kubernetes 1.35 cheat sheet">
		<div :class="layout.split">
			<div>
				<p :class="layout.kicker">Release: December 17, 2025</p>
				<h2 :class="s.heading">Kubernetes 1.35 Cheat Sheet</h2>
				<p :class="s.text">Your guide to mandatory cgroup v2, AI/ML scheduler primitives, and structured authentication. Everything you need in one place.</p>
				<Accordion.Root :multiple="true" :class="s.list">
					<Accordion.Item v-for="feature in features" :key="feature.id" :value="feature.id" :class="s.notice">
						<h3>
							<Accordion.ItemTrigger :class="layout.buttonSecondary">
								<span :class="s.tag">{{ categoryConfig[feature.category].label }}</span>
								{{ feature.title }}
								<Accordion.ItemIndicator aria-hidden="true">+</Accordion.ItemIndicator>
							</Accordion.ItemTrigger>
						</h3>
						<p :class="s.muted">{{ feature.subtitle }}</p>
						<Accordion.ItemContent :class="s.text">{{ feature.detail }}</Accordion.ItemContent>
					</Accordion.Item>
				</Accordion.Root>
			</div>
			<div :class="layout.sidebar">
				<div v-if="showSuccessState" :class="account.stack" role="status">
					<h3 :class="s.subheading">You're on the list!</h3>
					<p :class="s.text">Your cheat sheet is ready.</p>
					<a href="/resources/kubernetes/1.35-cheatsheet" :class="layout.button" @click="trackViewAssetClick">View Cheat Sheet</a>
				</div>
				<div v-else :class="account.stack">
					<h3 :class="s.subheading">Get the free cheat sheet</h3>
					<p :class="s.text">Subscribe to Kubernetes release updates to get the cheat sheet.</p>
					<p v-if="error" :class="account.error" role="alert">{{ error }}</p>
					<button v-if="isSignedIn" type="button" :class="layout.button" :disabled="isLoading" @click="subscribeAsLearner">
						{{ isLoading ? 'Subscribing…' : error ? 'Try again' : 'Get the Free Cheat Sheet' }}
					</button>
					<template v-else>
						<p :class="s.text">Sign in with GitHub to get instant access.</p>
						<a :href="signInUrl" :class="layout.button" @click="trackSignInClick">Sign in with GitHub</a>
					</template>
					<p :class="s.muted">No spam. Unsubscribe anytime.</p>
				</div>
			</div>
		</div>
	</section>
</template>
