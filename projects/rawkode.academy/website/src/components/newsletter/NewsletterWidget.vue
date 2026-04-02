<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { actions } from "astro:actions";
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
				: "Failed to subscribe. Please try again.";
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

const subscribeBtnStyle = css({
	w: "full",
	py: "2.5",
	px: "4",
	borderRadius: "xl",
	fontSize: "sm",
	fontWeight: "semibold",
	transition: "all",
	transitionDuration: "200ms",
	bg: "rgb(var(--brand-primary))",
	color: "white",
	_hover: { shadow: "lg", transform: "translateY(-2px)" },
	_active: { transform: "translateY(0)" },
	_disabled: { opacity: "0.7", cursor: "wait", _hover: { transform: "translateY(0)", shadow: "none" } },
});
</script>

<template>
	<template v-if="!shouldHide">
		<div :class="css({ w: 'full' })">
			<!-- Success State -->
			<Transition
				enter-active-class="transition duration-300 ease-out"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
			>
				<div
					v-if="showSubscribedState"
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2', py: '2.5', px: '4', borderRadius: 'xl', background: 'linear-gradient(to right, rgba(34,197,94,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.2)' })"
				>
					<svg :class="css({ w: '5', h: '5', color: 'green.500' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span :class="css({ fontSize: 'sm', fontWeight: 'medium', color: { base: 'green.700', _dark: 'green.300' } })">
						{{ isSuccess ? "You're in!" : "Subscribed" }}
					</span>
				</div>
			</Transition>

			<!-- Main CTA -->
			<div v-if="!showSubscribedState" :class="css({ w: 'full' })">
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
						:class="css({ mb: '2', p: '2.5', borderRadius: 'lg', bg: { base: 'red.50', _dark: 'red.900/20' }, border: '1px solid', borderColor: { base: 'red.200', _dark: 'red.800/50' }, color: { base: 'red.600', _dark: 'red.400' }, fontSize: 'xs', display: 'flex', alignItems: 'center', gap: '2' })"
					>
						<svg :class="css({ w: '4', h: '4', flexShrink: '0' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
						:class="subscribeBtnStyle"
					>
						<span :class="css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2' })">
							<svg v-if="isLoading" :class="css({ w: '4', h: '4', animation: 'spin' })" fill="none" viewBox="0 0 24 24">
								<circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
							<svg v-else :class="css({ w: '4', h: '4' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
							:class="subscribeBtnStyle"
						>
							<span :class="css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2' })">
								<svg :class="css({ w: '4', h: '4' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Subscribe
							</span>
						</button>

						<!-- Expanded form -->
						<form v-else @submit.prevent="handleSubmit" :class="css({ display: 'flex', flexDir: 'column', gap: '2' })">
							<!-- Email input with integrated submit -->
							<div :class="css({ position: 'relative' })">
								<input
									ref="emailInput"
									v-model="email"
									type="email"
									placeholder="you@example.com"
									required
									:disabled="isLoading"
									:class="css({ w: 'full', py: '2.5', pl: '4', pr: '12', borderRadius: 'xl', border: '2px solid', borderColor: { base: 'neutral.200', _dark: 'neutral.700' }, bg: { base: 'white', _dark: 'neutral.800/80' }, color: { base: 'neutral.900', _dark: 'white' }, _placeholder: { color: 'neutral.400' }, fontSize: 'sm', transition: 'all', transitionDuration: '200ms', _focus: { outline: 'none', borderColor: 'rgb(var(--brand-primary))', ring: '2px solid rgba(var(--brand-primary), 0.2)' }, _disabled: { opacity: '0.6' } })"
								/>
								<button
									type="submit"
									:disabled="isLoading || !email.trim()"
									:class="css({ position: 'absolute', right: '1.5', top: '50%', transform: 'translateY(-50%)', p: '1.5', borderRadius: 'lg', bg: 'rgb(var(--brand-primary))', color: 'white', transition: 'all', transitionDuration: '200ms', _hover: { opacity: '0.9' }, _disabled: { opacity: '0.5', cursor: 'not-allowed' } })"
									:title="isLoading ? 'Subscribing...' : 'Subscribe'"
								>
									<svg v-if="isLoading" :class="css({ w: '4', h: '4', animation: 'spin' })" fill="none" viewBox="0 0 24 24">
										<circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else :class="css({ w: '4', h: '4' })" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								</button>
							</div>

							<!-- Sign in option -->
							<div :class="css({ display: 'flex', alignItems: 'center', gap: '2' })">
								<div :class="css({ flex: '1', h: '1px', bg: { base: 'neutral.200', _dark: 'neutral.700' } })"></div>
								<span :class="css({ fontSize: 'xs', color: { base: 'neutral.400', _dark: 'neutral.500' } })">or</span>
								<div :class="css({ flex: '1', h: '1px', bg: { base: 'neutral.200', _dark: 'neutral.700' } })"></div>
							</div>

							<a
								:href="signInUrl"
								@click="trackSignInClick"
								:class="css({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', w: 'full', borderRadius: 'xl', px: '5', py: '2.5', fontSize: 'sm', fontWeight: 'semibold', letterSpacing: 'wide', color: 'white', background: 'linear-gradient(135deg, rgb(var(--brand-primary)), rgb(var(--brand-secondary)))', shadow: 'lg', border: '1px solid rgba(255,255,255,0.4)', _hover: { shadow: 'xl', transform: 'translateY(-2px)' }, _active: { transform: 'translateY(0)' }, transition: 'all', transitionDuration: '200ms' })"
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
