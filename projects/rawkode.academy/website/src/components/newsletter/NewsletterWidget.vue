<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { actions } from "astro:actions";
import { academyMarketing } from "@rawkodeacademy/design-system";
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
	audience?: string;
}>();
const marketing = academyMarketing();

const audience = props.audience || "academy";
const NEWSLETTER_COOKIE_NAME = `newsletter:${audience}:updates`;

const email = ref("");
const isLoading = ref(false);
const isSuccess = ref(false);
const error = ref<string | null>(null);
const isExpanded = ref(false);
const hasCookieSubscription = ref(false);
const emailInput = ref<HTMLInputElement | null>(null);

const fieldIdBase = computed(() => {
	const normalizedPath = props.pagePath
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `newsletter-${audience}-${normalizedPath || "home"}`;
});
const emailInputId = computed(() => `${fieldIdBase.value}-email`);
const emailHelpId = computed(() => `${fieldIdBase.value}-help`);

function createSource(): string {
	return `website:newsletter:${props.pagePath}`;
}

function createAttributionPayload(): string | undefined {
	return serializeCampaignAttribution(getSessionCampaignAttribution());
}

function getBaseGrowthProperties(
	method?: "learner" | "email" | "sign_in",
): Record<string, unknown> {
	return {
		audience,
		channel: "newsletter",
		page_path: props.pagePath,
		source: createSource(),
		is_authenticated: props.isSignedIn,
		entry_point: "newsletter_cta",
		...(method ? { method } : {}),
	};
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

	if (!shouldHide.value && !showSubscribedState.value) {
		captureGrowthClientEvent(
			GROWTH_EVENTS.NEWSLETTER_CTA_IMPRESSION,
			getBaseGrowthProperties(),
		);
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

	captureGrowthClientEvent(
		GROWTH_EVENTS.NEWSLETTER_CTA_CLICKED,
		getBaseGrowthProperties("learner"),
	);
	captureGrowthClientEvent(
		GROWTH_EVENTS.NEWSLETTER_SUBMISSION_ATTEMPTED,
		getBaseGrowthProperties("learner"),
	);

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } = await actions.newsletter.subscribe({
			audience,
			source: createSource(),
			attribution: createAttributionPayload(),
		});
		if (actionError) throw new Error(actionError.message);
		if (data?.success) isSuccess.value = true;
	} catch (err: unknown) {
		error.value =
			err instanceof Error
				? err.message
				: "Couldn't subscribe right now. Try again in a moment.";
	} finally {
		isLoading.value = false;
	}
};

const subscribeWithEmail = async () => {
	if (isLoading.value || !email.value.trim()) return;

	captureGrowthClientEvent(
		GROWTH_EVENTS.NEWSLETTER_SUBMISSION_ATTEMPTED,
		getBaseGrowthProperties("email"),
	);

	isLoading.value = true;
	error.value = null;

	try {
		const { data, error: actionError } =
			await actions.newsletter.subscribeWithEmail({
				email: email.value.trim(),
				audience,
				source: createSource(),
				attribution: createAttributionPayload(),
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
				: "Couldn't subscribe right now. Try again in a moment.";
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
	captureGrowthClientEvent(
		GROWTH_EVENTS.NEWSLETTER_CTA_CLICKED,
		getBaseGrowthProperties("email"),
	);
	isExpanded.value = true;
	error.value = null;
	await nextTick();
	emailInput.value?.focus();
};

const trackSignInClick = () => {
	captureGrowthClientEvent(
		GROWTH_EVENTS.NEWSLETTER_CTA_CLICKED,
		getBaseGrowthProperties("sign_in"),
	);
};
</script>

<template>
	<template v-if="!shouldHide">
		<div :class="marketing.newsletterWidget">
			<!-- Success State -->
			<div
				v-if="showSubscribedState"
				role="status"
				aria-live="polite"
				:class="marketing.newsletterSuccess"
			>
				<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>
					{{ isSuccess ? "You're in!" : "Subscribed" }}
				</span>
			</div>

			<!-- Main CTA -->
			<div v-if="!showSubscribedState">
				<!-- Error State -->
				<div
					v-if="error"
					role="alert"
					:class="marketing.newsletterError"
				>
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					{{ error }}
				</div>

				<!-- Signed-in user -->
				<template v-if="isSignedIn">
					<button
						type="button"
						@click="subscribeAsLearner"
						:disabled="isLoading"
						:class="marketing.newsletterButton"
					>
						<svg v-if="isLoading" :class="marketing.newsletterSpinner" fill="none" viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
						<svg v-else fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
						</svg>
						{{ isLoading ? "Subscribing..." : "Subscribe" }}
					</button>
				</template>

				<!-- Anonymous user -->
				<template v-else>
					<!-- Collapsed state -->
					<button
						v-if="!isExpanded"
						type="button"
						@click="expandForm"
						:class="marketing.newsletterButton"
					>
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
						Subscribe
					</button>

					<!-- Expanded form -->
					<form v-else @submit.prevent="handleSubmit" :class="marketing.newsletterForm">
						<!-- Email input with integrated submit -->
						<div :class="marketing.newsletterInputRow">
							<label :for="emailInputId" class="sr-only">
								Email address
							</label>
							<input
								:id="emailInputId"
								ref="emailInput"
								v-model="email"
								type="email"
								name="email"
								autocomplete="email"
								inputmode="email"
								autocapitalize="off"
								spellcheck="false"
								:aria-describedby="emailHelpId"
								:aria-invalid="error ? 'true' : 'false'"
								placeholder="you@example.com"
								required
								:disabled="isLoading"
								:class="marketing.newsletterField"
							/>
							<p :id="emailHelpId" class="sr-only">
								Get weekly cloud native updates in your inbox.
							</p>
							<button
								type="submit"
								:disabled="isLoading || !email.trim()"
								:class="marketing.newsletterSubmit"
								aria-label="Submit email subscription"
								:title="isLoading ? 'Subscribing...' : 'Subscribe'"
							>
								<svg v-if="isLoading" :class="marketing.newsletterSpinner" fill="none" viewBox="0 0 24 24">
									<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								<svg v-else fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
								</svg>
							</button>
						</div>

						<!-- Sign in option -->
						<div :class="marketing.newsletterDivider">
							<div :class="marketing.newsletterDividerLine"></div>
							<span :class="marketing.newsletterDividerText">or</span>
							<div :class="marketing.newsletterDividerLine"></div>
						</div>

						<a
							:href="signInUrl"
							@click="trackSignInClick"
							:class="marketing.newsletterSignIn"
						>
							Sign in instead
						</a>
					</form>
				</template>
			</div>
		</div>
	</template>
</template>
