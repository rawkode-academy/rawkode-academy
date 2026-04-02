<script setup lang="ts">
import { css } from "../../../styled-system/css";
import { ref, computed } from "vue";
import { actions } from "astro:actions";

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

const toggleSwitchBase = css({
	pos: 'relative',
	display: 'inline-flex',
	h: '6',
	w: '11',
	flexShrink: '0',
	cursor: 'pointer',
	rounded: 'full',
	borderWidth: '2px',
	borderColor: 'transparent',
	transition: 'colors',
	transitionDuration: '200ms',
	transitionTimingFunction: 'ease-in-out',
	_focus: { outline: 'none', ringWidth: '2px', ringColor: 'primary', ringOffsetWidth: '2px' },
});

const toggleKnobBase = css({
	pointerEvents: 'none',
	display: 'inline-block',
	h: '5',
	w: '5',
	transform: 'translateX(0)',
	rounded: 'full',
	bg: 'white',
	shadow: 'sm',
	ringWidth: '0',
	transition: 'all',
	transitionDuration: '200ms',
	transitionTimingFunction: 'ease-in-out',
});
</script>

<template>
	<div :class="css({ display: 'flex', flexDir: 'column', gap: '8' })">
		<!-- Newsletters Section -->
		<div>
			<h3
				:class="css({ fontSize: 'sm', fontWeight: 'semibold', color: { base: 'neutral.700', _dark: 'neutral.300' }, textTransform: 'uppercase', letterSpacing: 'wide', mb: '3' })"
			>
				Newsletters
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '3' })">
				<!-- Academy Newsletter -->
				<div
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', rounded: 'xl', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="css({ fontSize: 'base', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
							Academy Newsletter
						</h4>
						<p :class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, mt: '1' })">
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
							toggleSwitchBase,
							css({ _dark: { ringOffsetColor: 'neutral.900' } }),
							preferences.academyNewsletter
								? css({ bg: 'primary' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'academyNewsletter' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.academyNewsletter"
					>
						<span :class="css({ srOnly: true })">Toggle academy newsletter</span>
						<span
							:class="[
								toggleKnobBase,
								preferences.academyNewsletter
									? css({ transform: 'translateX(1.25rem)' })
									: css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Technology Matrix Updates -->
				<div
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', rounded: 'xl', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="css({ fontSize: 'base', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
							Technology Matrix Updates
						</h4>
						<p :class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, mt: '1' })">
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
							toggleSwitchBase,
							css({ _dark: { ringOffsetColor: 'neutral.900' } }),
							preferences.matrixNewsletter
								? css({ bg: 'primary' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'matrixNewsletter' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.matrixNewsletter"
					>
						<span :class="css({ srOnly: true })">Toggle matrix updates</span>
						<span
							:class="[
								toggleKnobBase,
								preferences.matrixNewsletter
									? css({ transform: 'translateX(1.25rem)' })
									: css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Kubernetes Release Updates -->
				<div
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', rounded: 'xl', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="css({ fontSize: 'base', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
							Kubernetes Release Updates
						</h4>
						<p :class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, mt: '1' })">
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
							toggleSwitchBase,
							css({ _dark: { ringOffsetColor: 'neutral.900' } }),
							preferences.kubernetesReleaseUpdates
								? css({ bg: 'primary' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'kubernetesReleaseUpdates' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.kubernetesReleaseUpdates"
					>
						<span :class="css({ srOnly: true })">Toggle Kubernetes release updates</span>
						<span
							:class="[
								toggleKnobBase,
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
			<h3
				:class="css({ fontSize: 'sm', fontWeight: 'semibold', color: { base: 'neutral.700', _dark: 'neutral.300' }, textTransform: 'uppercase', letterSpacing: 'wide', mb: '3' })"
			>
				Technology Updates
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '2' })">
				<div
					v-for="techId in techSubs"
					:key="techId"
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '3', rounded: 'lg', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
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
			<h3
				:class="css({ fontSize: 'sm', fontWeight: 'semibold', color: { base: 'neutral.700', _dark: 'neutral.300' }, textTransform: 'uppercase', letterSpacing: 'wide', mb: '3' })"
			>
				Communication Preferences
			</h3>
			<div :class="css({ display: 'flex', flexDir: 'column', gap: '3' })">
				<!-- Marketing Emails -->
				<div
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', rounded: 'xl', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="css({ fontSize: 'base', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
							Marketing Emails
						</h4>
						<p :class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, mt: '1' })">
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
							toggleSwitchBase,
							css({ _dark: { ringOffsetColor: 'neutral.900' } }),
							preferences.marketingEmails
								? css({ bg: 'primary' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'marketingEmails' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.marketingEmails"
					>
						<span :class="css({ srOnly: true })">Toggle marketing emails</span>
						<span
							:class="[
								toggleKnobBase,
								preferences.marketingEmails ? css({ transform: 'translateX(1.25rem)' }) : css({ transform: 'translateX(0)' }),
							]"
						/>
					</button>
				</div>

				<!-- Service Notifications -->
				<div
					:class="css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: '4', rounded: 'xl', bg: { base: 'rgba(255,255,255,0.5)', _dark: 'rgba(255,255,255,0.05)' }, borderWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
				>
					<div :class="css({ flex: '1', pr: '4' })">
						<h4 :class="css({ fontSize: 'base', fontWeight: 'medium', color: { base: 'neutral.900', _dark: 'white' } })">
							Service Notifications
						</h4>
						<p :class="css({ fontSize: 'sm', color: { base: 'neutral.500', _dark: 'neutral.400' }, mt: '1' })">
							Account-related notifications like login alerts and security
							notices.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'serviceEmails'"
						@click="togglePreference('serviceEmails', 'service', 'academy')"
						:class="[
							toggleSwitchBase,
							css({ _dark: { ringOffsetColor: 'neutral.900' } }),
							preferences.serviceEmails
								? css({ bg: 'primary' })
								: css({ bg: { base: 'neutral.300', _dark: 'neutral.700' } }),
							isLoading === 'serviceEmails' ? css({ opacity: '0.5', cursor: 'wait' }) : '',
						]"
						role="switch"
						:aria-checked="preferences.serviceEmails"
					>
						<span :class="css({ srOnly: true })">Toggle service notifications</span>
						<span
							:class="[
								toggleKnobBase,
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
			:class="css({ display: 'flex', alignItems: 'center', gap: '2', p: '3', rounded: 'lg', bg: { base: 'green.50', _dark: 'green.900/20' }, color: { base: 'green.700', _dark: 'green.400' }, fontSize: 'sm' })"
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
			:class="css({ display: 'flex', alignItems: 'center', gap: '2', p: '3', rounded: 'lg', bg: { base: 'red.50', _dark: 'red.900/20' }, color: { base: 'red.700', _dark: 'red.400' }, fontSize: 'sm' })"
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
			:class="css({ pt: '6', borderTopWidth: '1px', borderColor: { base: 'neutral.200', _dark: 'neutral.800' } })"
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
				:class="css({ p: '4', rounded: 'xl', bg: { base: 'red.50', _dark: 'red.900/20' }, borderWidth: '1px', borderColor: { base: 'red.200', _dark: 'red.800' } })"
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
						:class="css({ px: '4', py: '2', fontSize: 'sm', fontWeight: 'medium', color: 'white', bg: 'red.600', rounded: 'lg', _hover: { bg: 'red.700' }, _disabled: { opacity: '0.5', cursor: 'wait' } })"
					>
						{{ isUnsubscribingAll ? "Unsubscribing..." : "Yes, unsubscribe" }}
					</button>
					<button
						type="button"
						:disabled="isUnsubscribingAll"
						@click="showUnsubscribeConfirm = false"
						:class="css({ px: '4', py: '2', fontSize: 'sm', fontWeight: 'medium', color: { base: 'neutral.700', _dark: 'neutral.300' }, rounded: 'lg', _hover: { bg: { base: 'neutral.100', _dark: 'neutral.800' } } })"
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
				:class="css({ fontSize: 'sm', color: 'primary', mt: '1', display: 'inline-block', _hover: { textDecoration: 'underline' } })"
			>
				Explore content and subscribe
			</a>
		</div>
	</div>
</template>
