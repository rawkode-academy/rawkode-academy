<script setup lang="ts">
import { ref, computed } from "vue";
import { actions } from "astro:actions";
import { css } from "../../../styled-system/css";

const props = defineProps<{
	academyNewsletter: boolean;
	matrixNewsletter: boolean;
	kubernetesReleaseUpdates: boolean;
	marketingEmails: boolean;
	serviceEmails: boolean;
	technologySubscriptions: string[];
}>();

const preferences = ref({
	academyNewsletter: props.academyNewsletter,
	matrixNewsletter: props.matrixNewsletter,
	kubernetesReleaseUpdates: props.kubernetesReleaseUpdates,
	marketingEmails: props.marketingEmails,
	serviceEmails: props.serviceEmails,
});

const techSubs = ref<string[]>([...props.technologySubscriptions]);
const isLoading = ref<string | null>(null);
const error = ref<string | null>(null);
const showSuccess = ref(false);
const showUnsubscribeConfirm = ref(false);
const isUnsubscribingAll = ref(false);

const hasAnySubscription = computed(() => {
	return (
		preferences.value.academyNewsletter ||
		preferences.value.matrixNewsletter ||
		preferences.value.kubernetesReleaseUpdates ||
		preferences.value.marketingEmails ||
		preferences.value.serviceEmails ||
		techSubs.value.length > 0
	);
});

const togglePreference = async (
	key: keyof typeof preferences.value,
	channel: "newsletter" | "marketing" | "service",
	audience: string,
) => {
	if (isLoading.value) return;

	isLoading.value = key;
	error.value = null;
	showSuccess.value = false;

	const newValue = !preferences.value[key];

	try {
		const { error: actionError } = await actions.newsletter.setPreference({
			channel,
			audience,
			subscribed: newValue,
			source: "settings-page",
		});
		if (actionError) throw new Error(actionError.message);
		preferences.value[key] = newValue;
		showSuccess.value = true;
		setTimeout(() => {
			showSuccess.value = false;
		}, 3000);
	} catch (err: any) {
		error.value = err.message || "Failed to update preference";
	} finally {
		isLoading.value = null;
	}
};

const unsubscribeTechnology = async (techId: string) => {
	if (isLoading.value) return;

	isLoading.value = `tech-${techId}`;
	error.value = null;

	try {
		const { error: actionError } = await actions.newsletter.setPreference({
			channel: "newsletter",
			audience: `technology:${techId}`,
			subscribed: false,
			source: "settings-page",
		});
		if (actionError) throw new Error(actionError.message);
		techSubs.value = techSubs.value.filter((t) => t !== techId);
		showSuccess.value = true;
		setTimeout(() => {
			showSuccess.value = false;
		}, 3000);
	} catch (err: any) {
		error.value = err.message || "Failed to unsubscribe";
	} finally {
		isLoading.value = null;
	}
};

const unsubscribeFromAll = async () => {
	if (isUnsubscribingAll.value) return;

	isUnsubscribingAll.value = true;
	error.value = null;

	try {
		const { error: actionError } = await actions.newsletter.unsubscribeAll({
			source: "settings-page",
		});
		if (actionError) throw new Error(actionError.message);

		preferences.value = {
			academyNewsletter: false,
			matrixNewsletter: false,
			kubernetesReleaseUpdates: false,
			marketingEmails: false,
			serviceEmails: false,
		};
		techSubs.value = [];
		showUnsubscribeConfirm.value = false;
		showSuccess.value = true;
		setTimeout(() => {
			showSuccess.value = false;
		}, 3000);
	} catch (err: any) {
		error.value = err.message || "Failed to unsubscribe from all";
	} finally {
		isUnsubscribingAll.value = false;
	}
};

const formatTechName = (id: string) => {
	return id
		.split("/")
		.pop()
		?.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

const sectionTitleStyle = css({
	fontSize: "sm",
	fontWeight: "semibold",
	color: { base: "neutral.700", _dark: "neutral.300" },
	textTransform: "uppercase",
	letterSpacing: "wide",
	mb: "3",
});

const prefRowStyle = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	p: "4",
	borderRadius: "xl",
	bg: { base: "white/50", _dark: "white/5" },
	border: "1px solid",
	borderColor: { base: "neutral.200", _dark: "neutral.800" },
});

const prefTitleStyle = css({
	fontSize: "base",
	fontWeight: "medium",
	color: { base: "neutral.900", _dark: "white" },
});

const prefDescStyle = css({
	fontSize: "sm",
	color: { base: "neutral.500", _dark: "neutral.400" },
	mt: "1",
});

const toggleBaseStyle = css({
	position: "relative",
	display: "inline-flex",
	h: "6",
	w: "11",
	flexShrink: "0",
	cursor: "pointer",
	borderRadius: "full",
	border: "2px solid transparent",
	transition: "colors",
	transitionDuration: "200ms",
	transitionTimingFunction: "ease-in-out",
	_focus: { outline: "none", ring: "2px solid", ringColor: "rgb(var(--brand-primary))", ringOffset: "2px" },
});

const toggleKnobStyle = css({
	pointerEvents: "none",
	display: "inline-block",
	h: "5",
	w: "5",
	transform: "translateX(0)",
	borderRadius: "full",
	bg: "white",
	shadow: "sm",
	ring: "0",
	transition: "transform",
	transitionDuration: "200ms",
	transitionTimingFunction: "ease-in-out",
});
</script>

<template>
	<div :class="css({ display: 'flex', flexDir: 'column', gap: '8' })">
		<!-- Newsletters Section -->
		<div>
			<h3 :class="sectionTitleStyle">
				Newsletters
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '3' })">
				<!-- Academy Newsletter -->
				<div :class="prefRowStyle">
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="prefTitleStyle">
							Academy Newsletter
						</h4>
						<p :class="prefDescStyle">
							Updates about new courses, videos, articles, and cloud native
							content.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'academyNewsletter'"
						@click="
							togglePreference('academyNewsletter', 'newsletter', 'academy')
						"
						:class="[
							toggleBaseStyle,
							preferences.academyNewsletter
								? css({ bg: 'rgb(var(--brand-primary))' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'academyNewsletter' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.academyNewsletter"
					>
						<span :class="css({ srOnly: true })">Toggle academy newsletter</span>
						<span
							:class="[
								toggleKnobStyle,
								preferences.academyNewsletter
									? css({ transform: 'translateX(1.25rem)' })
									: css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Technology Matrix Updates -->
				<div :class="prefRowStyle">
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="prefTitleStyle">
							Technology Matrix Updates
						</h4>
						<p :class="prefDescStyle">
							Get notified when technologies move through the matrix or new
							opinions are added.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'matrixNewsletter'"
						@click="
							togglePreference('matrixNewsletter', 'newsletter', 'matrix')
						"
						:class="[
							toggleBaseStyle,
							preferences.matrixNewsletter
								? css({ bg: 'rgb(var(--brand-primary))' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'matrixNewsletter' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.matrixNewsletter"
					>
						<span :class="css({ srOnly: true })">Toggle matrix updates</span>
						<span
							:class="[
								toggleKnobStyle,
								preferences.matrixNewsletter
									? css({ transform: 'translateX(1.25rem)' })
									: css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Kubernetes Release Updates -->
				<div :class="prefRowStyle">
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="prefTitleStyle">
							Kubernetes Release Updates
						</h4>
						<p :class="prefDescStyle">
							Get notified about new Kubernetes releases, cheat sheets, and
							upgrade guides.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'kubernetesReleaseUpdates'"
						@click="
							togglePreference('kubernetesReleaseUpdates', 'newsletter', 'kubernetes-release-updates')
						"
						:class="[
							toggleBaseStyle,
							preferences.kubernetesReleaseUpdates
								? css({ bg: 'rgb(var(--brand-primary))' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'kubernetesReleaseUpdates' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.kubernetesReleaseUpdates"
					>
						<span :class="css({ srOnly: true })">Toggle Kubernetes release updates</span>
						<span
							:class="[
								toggleKnobStyle,
								preferences.kubernetesReleaseUpdates
									? css({ transform: 'translateX(1.25rem)' })
									: css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>
			</div>
		</div>

		<!-- Technology-Specific Subscriptions -->
		<div v-if="techSubs.length > 0">
			<h3 :class="sectionTitleStyle">
				Technology Updates
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '2' })">
				<div
					v-for="techId in techSubs"
					:key="techId"
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '3', borderRadius: 'lg', bg: { base: 'white/50', _dark: 'white/5' }, border: '1px solid', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<span :class="css({ fontSize: 'sm', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
						{{ formatTechName(techId) }}
					</span>
					<button
						type="button"
						:disabled="isLoading === `tech-${techId}`"
						@click="unsubscribeTechnology(techId)"
						:class="css({ fontSize: 'sm', color: { base: 'red.600', _dark: 'red.400' }, fontWeight: 'medium', _hover: { color: { base: 'red.700', _dark: 'red.300' } }, _disabled: { opacity: '0.5' } })"
					>
						{{ isLoading === `tech-${techId}` ? "..." : "Unsubscribe" }}
					</button>
				</div>
			</div>
		</div>

		<!-- Communication Preferences Section -->
		<div>
			<h3 :class="sectionTitleStyle">
				Communication Preferences
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '3' })">
				<!-- Marketing Emails -->
				<div :class="prefRowStyle">
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="prefTitleStyle">
							Marketing Emails
						</h4>
						<p :class="prefDescStyle">
							Product announcements, promotions, and partner offers.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'marketingEmails'"
						@click="
							togglePreference('marketingEmails', 'marketing', 'academy')
						"
						:class="[
							toggleBaseStyle,
							preferences.marketingEmails
								? css({ bg: 'rgb(var(--brand-primary))' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'marketingEmails' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.marketingEmails"
					>
						<span :class="css({ srOnly: true })">Toggle marketing emails</span>
						<span
							:class="[
								toggleKnobStyle,
								preferences.marketingEmails ? css({ transform: 'translateX(1.25rem)' }) : css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Service Notifications -->
				<div :class="prefRowStyle">
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="prefTitleStyle">
							Service Notifications
						</h4>
						<p :class="prefDescStyle">
							Account-related notifications like login alerts and security
							notices.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'serviceEmails'"
						@click="togglePreference('serviceEmails', 'service', 'academy')"
						:class="[
							toggleBaseStyle,
							preferences.serviceEmails
								? css({ bg: 'rgb(var(--brand-primary))' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'serviceEmails' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.serviceEmails"
					>
						<span :class="css({ srOnly: true })">Toggle service notifications</span>
						<span
							:class="[
								toggleKnobStyle,
								preferences.serviceEmails ? css({ transform: 'translateX(1.25rem)' }) : css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>
			</div>
		</div>

		<!-- Success Message -->
		<div
			v-if="showSuccess"
			:class="css({ display: 'flex', alignItems: 'center', gap: '2', p: '3', borderRadius: 'lg', bg: { base: 'green.50', _dark: 'green.900/20' }, color: { base: 'green.700', _dark: 'green.400' }, fontSize: 'sm' })"
		>
			<svg
				:class="css({ w: '5', h: '5', flexShrink: '0' })"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 13l4 4L19 7"
				/>
			</svg>
			<span>Your preferences have been updated.</span>
		</div>

		<!-- Error Message -->
		<div
			v-if="error"
			:class="css({ display: 'flex', alignItems: 'center', gap: '2', p: '3', borderRadius: 'lg', bg: { base: 'red.50', _dark: 'red.900/20' }, color: { base: 'red.700', _dark: 'red.400' }, fontSize: 'sm' })"
		>
			<svg
				:class="css({ w: '5', h: '5', flexShrink: '0' })"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{{ error }}</span>
		</div>

		<!-- Unsubscribe from All Section -->
		<div
			:class="css({ pt: '6', borderTop: '1px solid', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
			v-if="hasAnySubscription"
		>
			<div v-if="!showUnsubscribeConfirm">
				<button
					type="button"
					@click="showUnsubscribeConfirm = true"
					:class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, transition: 'colors', _hover: { color: { base: 'red.600', _dark: 'red.400' } } })"
				>
					Unsubscribe from all emails
				</button>
			</div>
			<div
				v-else
				:class="css({ p: '4', borderRadius: 'xl', bg: { base: 'red.50', _dark: 'red.900/20' }, border: '1px solid', borderColor: { base: 'red.200', _dark: 'red.800' } })"
			>
				<p :class="css({ fontSize: 'sm', color: { base: 'red.700', _dark: 'red.300' }, mb: '3' })">
					Are you sure you want to unsubscribe from all emails? You will stop
					receiving all newsletters and notifications from Rawkode Academy.
				</p>
				<div :class="css({ display: 'flex', gap: '3' })">
					<button
						type="button"
						:disabled="isUnsubscribingAll"
						@click="unsubscribeFromAll"
						:class="css({ px: '4', py: '2', fontSize: 'sm', fontWeight: 'medium', color: 'white', bg: 'red.600', borderRadius: 'lg', _hover: { bg: 'red.700' }, _disabled: { opacity: '0.5', cursor: 'wait' } })"
					>
						{{ isUnsubscribingAll ? "Unsubscribing..." : "Yes, unsubscribe" }}
					</button>
					<button
						type="button"
						:disabled="isUnsubscribingAll"
						@click="showUnsubscribeConfirm = false"
						:class="css({ px: '4', py: '2', fontSize: 'sm', fontWeight: 'medium', color: { base: 'neutral.700', _dark: 'neutral.300' }, borderRadius: 'lg', _hover: { bg: { base: 'neutral.100', _dark: 'neutral.800' } } })"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>

		<!-- No Subscriptions Message -->
		<div
			v-if="!hasAnySubscription"
			:class="css({ textAlign: 'center', py: '4', color: { base: 'neutral.500', _dark: 'neutral.400' } })"
		>
			<p :class="css({ fontSize: 'sm' })">You are not subscribed to any emails.</p>
			<a
				href="/"
				:class="css({ fontSize: 'sm', color: 'rgb(var(--brand-primary))', _hover: { textDecoration: 'underline' }, mt: '1', display: 'inline-block' })"
			>
				Explore content and subscribe
			</a>
		</div>
	</div>
</template>
