<script setup lang="ts">
import { academyAccount, dialog, academyLayout } from "@rawkodeacademy/design-system";
const account = academyAccount();
const modal = dialog({ tone: "academy" });
const layout = academyLayout();

import { Dialog } from "@ark-ui/vue/dialog";
import { actions } from "astro:actions";
import { computed, ref } from "vue";
import PreferenceSwitch from "./PreferenceSwitch.vue";

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
	if (isLoading.value || isUnsubscribingAll.value) return;

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
	if (isLoading.value || isUnsubscribingAll.value) return;

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
	if (isUnsubscribingAll.value || isLoading.value) return;

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
		.replace(/\/index$/, "")
		.split("/")
		.pop()
		?.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};
</script>

<template>
	<div :class="account.stack">
		<!-- Newsletters Section -->
		<div>
			<h3
				:class="account.heading"
			>
				Newsletters
			</h3>
			<div :class="account.list">
				<!-- Academy Newsletter -->
				<div
					:class="account.preference"
				>
					<div :class="account.copy">
						<h4 :class="account.label">
							Academy Newsletter
						</h4>
						<p :class="account.description">
							Updates about new courses, videos, articles, and cloud native
							content.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.academyNewsletter" :disabled="Boolean(isLoading) || isUnsubscribingAll" label="Toggle academy newsletter" @change="togglePreference('academyNewsletter', 'newsletter', 'academy')" />
				</div>

				<!-- Technology Matrix Updates -->
				<div
					:class="account.preference"
				>
					<div :class="account.copy">
						<h4 :class="account.label">
							Technology Matrix Updates
						</h4>
						<p :class="account.description">
							Get notified when technologies move through the matrix or new
							opinions are added.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.matrixNewsletter" :disabled="Boolean(isLoading) || isUnsubscribingAll" label="Toggle matrix updates" @change="togglePreference('matrixNewsletter', 'newsletter', 'matrix')" />
				</div>

				<!-- Kubernetes Release Updates -->
				<div
					:class="account.preference"
				>
					<div :class="account.copy">
						<h4 :class="account.label">
							Kubernetes Release Updates
						</h4>
						<p :class="account.description">
							Get notified about new Kubernetes releases, cheat sheets, and
							upgrade guides.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.kubernetesReleaseUpdates" :disabled="Boolean(isLoading) || isUnsubscribingAll" label="Toggle Kubernetes release updates" @change="togglePreference('kubernetesReleaseUpdates', 'newsletter', 'kubernetes-release-updates')" />
				</div>
			</div>
		</div>

		<!-- Technology-Specific Subscriptions -->
		<div v-if="techSubs.length > 0">
			<h3
				:class="account.heading"
			>
				Technology Updates
			</h3>
			<div :class="account.list">
				<div
					v-for="techId in techSubs"
					:key="techId"
					:class="account.preference"
				>
					<span :class="account.label">
						{{ formatTechName(techId) }}
					</span>
					<button
						type="button"
						:disabled="Boolean(isLoading) || isUnsubscribingAll"
						@click="unsubscribeTechnology(techId)"
						:class="account.danger"
					>
						{{ isLoading === `tech-${techId}` ? "..." : "Unsubscribe" }}
					</button>
				</div>
			</div>
		</div>

		<!-- Communication Preferences Section -->
		<div>
			<h3
				:class="account.heading"
			>
				Communication Preferences
			</h3>
			<div :class="account.list">
				<!-- Marketing Emails -->
				<div
					:class="account.preference"
				>
					<div :class="account.copy">
						<h4 :class="account.label">
							Marketing Emails
						</h4>
						<p :class="account.description">
							Product announcements, promotions, and partner offers.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.marketingEmails" :disabled="Boolean(isLoading) || isUnsubscribingAll" label="Toggle marketing emails" @change="togglePreference('marketingEmails', 'marketing', 'academy')" />
				</div>

				<!-- Service Notifications -->
				<div
					:class="account.preference"
				>
					<div :class="account.copy">
						<h4 :class="account.label">
							Service Notifications
						</h4>
						<p :class="account.description">
							Account-related notifications like login alerts and security
							notices.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.serviceEmails" :disabled="Boolean(isLoading) || isUnsubscribingAll" label="Toggle service notifications" @change="togglePreference('serviceEmails', 'service', 'academy')" />
				</div>
			</div>
		</div>

		<!-- Success Message -->
		<div
			v-if="showSuccess" role="status"
			:class="account.success"
		>
			<svg
				:class="account.icon"
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
			v-if="error" role="alert"
			:class="account.error"
		>
			<svg
				:class="account.icon"
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
			:class="account.divider"
			v-if="hasAnySubscription"
		>
			<Dialog.Root :open="showUnsubscribeConfirm" @open-change="showUnsubscribeConfirm = $event.open">
				<Dialog.Trigger :class="account.danger">
					Unsubscribe from all emails
				</Dialog.Trigger>
				<Teleport to="body">
					<Dialog.Backdrop :class="modal.backdrop" />
					<Dialog.Positioner :class="modal.positioner">
						<Dialog.Content :class="modal.content">
							<div :class="modal.body">
							<Dialog.Title :class="account.title">Unsubscribe from all emails?</Dialog.Title>
							<p v-if="error" role="alert" :class="account.error">{{ error }}</p>
							<Dialog.Description :class="modal.description">
								You will stop receiving all newsletters and notifications from Rawkode Academy.
							</Dialog.Description>
							<div :class="account.actions">
								<button type="button" :disabled="isUnsubscribingAll" @click="unsubscribeFromAll" :class="account.button">
									{{ isUnsubscribingAll ? "Unsubscribing..." : "Yes, unsubscribe" }}
								</button>
								<Dialog.CloseTrigger :disabled="isUnsubscribingAll" :class="layout.buttonSecondary">Cancel</Dialog.CloseTrigger>
							</div>
						</div>
						</Dialog.Content>
					</Dialog.Positioner>
				</Teleport>
			</Dialog.Root>
		</div>

		<!-- No Subscriptions Message -->
		<div
			v-if="!hasAnySubscription"
			:class="account.empty"
		>
			<p class="text-sm">You are not subscribed to any emails.</p>
			<a
				href="/"
				:class="account.link"
			>
				Explore content and subscribe
			</a>
		</div>
	</div>
</template>
