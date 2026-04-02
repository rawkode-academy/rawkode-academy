<script setup lang="ts">
import { css, cx } from "styled-system/css";
import { ref, computed, onMounted, nextTick } from "vue";
import { actions } from "astro:actions";
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

const wFull = css({ w: 'full' });
const successBanner = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '2',
	py: '2.5',
	px: '4',
	rounded: 'xl',
	bgGradient: 'to-r',
	gradientFrom: 'green.500/10',
	gradientTo: 'emerald.500/10',
	borderWidth: '1px',
	borderColor: 'green.500/20',
});
const successIcon = css({ w: '5', h: '5', color: 'green.500' });
const successLabel = css({
	fontSize: 'sm',
	fontWeight: 'medium',
	color: { base: 'green.700', _dark: 'green.300' },
});
const errorBox = css({
	mb: '2',
	p: '2.5',
	rounded: 'lg',
	bg: { base: 'red.50', _dark: 'red.900/20' },
	borderWidth: '1px',
	borderColor: { base: 'red.200', _dark: 'red.800/50' },
	color: { base: 'red.600', _dark: 'red.400' },
	fontSize: 'xs',
	display: 'flex',
	alignItems: 'center',
	gap: '2',
});
const errorIcon = css({ w: '4', h: '4', flexShrink: '0' });
const subscribeBtn = css({
	w: 'full',
	py: '2.5',
	px: '4',
	rounded: 'xl',
	fontSize: 'sm',
	fontWeight: 'semibold',
	transition: 'all',
	transitionDuration: '200ms',
	bg: 'primary',
	color: 'white',
	_hover: {
		shadow: 'lg',
		translateY: '-0.5',
	},
	_active: { translateY: '0' },
	_disabled: {
		opacity: '0.7',
		cursor: 'wait',
		_hover: { translateY: '0', shadow: 'none' },
	},
});
const btnContent = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '2',
});
const spinIcon = css({ w: '4', h: '4', animation: 'spin' });
const opacity25 = css({ opacity: '0.25' });
const opacity75 = css({ opacity: '0.75' });
const bellIcon = css({
	w: '4',
	h: '4',
	transition: 'transform',
});
const spaceY2 = css({ display: 'flex', flexDir: 'column', gap: '2' });
const relativeStyle = css({ pos: 'relative' });
const emailInputStyle = css({
	w: 'full',
	py: '2.5',
	pl: '4',
	pr: '12',
	rounded: 'xl',
	borderWidth: '2px',
	borderColor: { base: 'neutral.200', _dark: 'neutral.700' },
	bg: { base: 'white', _dark: 'neutral.800/80' },
	color: { base: 'neutral.900', _dark: 'white' },
	fontSize: 'sm',
	transition: 'all',
	transitionDuration: '200ms',
	_placeholder: { color: 'neutral.400' },
	_focus: {
		outline: 'none',
		borderColor: 'primary',
		ringWidth: '2px',
		ringColor: 'primary/20',
	},
	_disabled: { opacity: '0.6' },
});
const submitBtn = css({
	pos: 'absolute',
	right: '1.5',
	top: '50%',
	translateY: '-50%',
	p: '1.5',
	rounded: 'lg',
	bg: 'primary',
	color: 'white',
	transition: 'all',
	transitionDuration: '200ms',
	_hover: { bg: 'primary/90' },
	_disabled: { opacity: '0.5', cursor: 'not-allowed' },
});
const submitIcon = css({ w: '4', h: '4' });
const dividerRow = css({ display: 'flex', alignItems: 'center', gap: '2' });
const dividerLine = css({
	flex: '1',
	h: '1px',
	bg: { base: 'neutral.200', _dark: 'neutral.700' },
});
const dividerText = css({
	fontSize: 'xs',
	color: { base: 'neutral.400', _dark: 'neutral.500' },
});
const signInLink = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	w: 'full',
	rounded: 'xl',
	px: '5',
	py: '2.5',
	fontSize: 'sm',
	fontWeight: 'semibold',
	letterSpacing: 'wide',
	color: 'white',
	shadow: 'lg',
	_hover: { shadow: 'xl', translateY: '-0.5' },
	borderWidth: '1px',
	borderColor: { base: 'white/40', _dark: 'white/10' },
	_active: { translateY: '0' },
	transition: 'all',
	transitionDuration: '200ms',
});
</script>

<template>
	<template v-if="!shouldHide">
		<div :class="wFull">
			<!-- Success State -->
			<Transition
				enter-active-class="transition duration-300 ease-out"
				enter-from-class="opacity-0 scale-95"
				enter-to-class="opacity-100 scale-100"
			>
				<div
					v-if="showSubscribedState"
					:class="successBanner"
				>
					<svg :class="successIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span :class="successLabel">
						{{ isSuccess ? "You're in!" : "Subscribed" }}
					</span>
				</div>
			</Transition>

			<!-- Main CTA -->
			<div v-if="!showSubscribedState" :class="wFull">
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
						:class="errorBox"
					>
						<svg :class="errorIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
						:class="subscribeBtn"
					>
						<span :class="btnContent">
							<svg v-if="isLoading" :class="spinIcon" fill="none" viewBox="0 0 24 24">
								<circle :class="opacity25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path :class="opacity75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
							<svg v-else :class="bellIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
							:class="subscribeBtn"
						>
							<span :class="btnContent">
								<svg :class="bellIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Subscribe
							</span>
						</button>

						<!-- Expanded form -->
						<form v-else @submit.prevent="handleSubmit" :class="spaceY2">
							<!-- Email input with integrated submit -->
							<div :class="relativeStyle">
								<input
									ref="emailInput"
									v-model="email"
									type="email"
									placeholder="you@example.com"
									required
									:disabled="isLoading"
									:class="emailInputStyle"
								/>
								<button
									type="submit"
									:disabled="isLoading || !email.trim()"
									:class="submitBtn"
									:title="isLoading ? 'Subscribing...' : 'Subscribe'"
								>
									<svg v-if="isLoading" :class="spinIcon" fill="none" viewBox="0 0 24 24">
										<circle :class="opacity25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path :class="opacity75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									<svg v-else :class="submitIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								</button>
							</div>

							<!-- Sign in option -->
							<div :class="dividerRow">
								<div :class="dividerLine"></div>
								<span :class="dividerText">or</span>
								<div :class="dividerLine"></div>
							</div>

							<a
								:href="signInUrl"
								@click="trackSignInClick"
								:class="cx('bg-gradient-primary', signInLink)"
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
