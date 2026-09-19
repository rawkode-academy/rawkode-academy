<script setup lang="ts">
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
</script>

<template>
	<div class="space-y-8">
		<!-- Newsletters Section -->
		<div>
			<h3
				class="text-sm font-semibold text-secondary-content uppercase tracking-wide mb-3"
			>
				Newsletters
			</h3>
			<div class="space-y-3">
				<!-- Academy Newsletter -->
				<div
					class="flex items-center justify-between p-4 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-primary-content">
							Academy Newsletter
						</h4>
						<p class="text-sm text-muted mt-1">
							Updates about new courses, videos, articles, and cloud native
							content.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.academyNewsletter" :disabled="isLoading === 'academyNewsletter'" label="Toggle academy newsletter" @change="togglePreference('academyNewsletter', 'newsletter', 'academy')" />
				</div>

				<!-- Technology Matrix Updates -->
				<div
					class="flex items-center justify-between p-4 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-primary-content">
							Technology Matrix Updates
						</h4>
						<p class="text-sm text-muted mt-1">
							Get notified when technologies move through the matrix or new
							opinions are added.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.matrixNewsletter" :disabled="isLoading === 'matrixNewsletter'" label="Toggle matrix updates" @change="togglePreference('matrixNewsletter', 'newsletter', 'matrix')" />
				</div>

				<!-- Kubernetes Release Updates -->
				<div
					class="flex items-center justify-between p-4 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-primary-content">
							Kubernetes Release Updates
						</h4>
						<p class="text-sm text-muted mt-1">
							Get notified about new Kubernetes releases, cheat sheets, and
							upgrade guides.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.kubernetesReleaseUpdates" :disabled="isLoading === 'kubernetesReleaseUpdates'" label="Toggle Kubernetes release updates" @change="togglePreference('kubernetesReleaseUpdates', 'newsletter', 'kubernetes-release-updates')" />
				</div>
			</div>
		</div>

		<!-- Technology-Specific Subscriptions -->
		<div v-if="techSubs.length > 0">
			<h3
				class="text-sm font-semibold text-secondary-content uppercase tracking-wide mb-3"
			>
				Technology Updates
			</h3>
			<div class="space-y-2">
				<div
					v-for="techId in techSubs"
					:key="techId"
					class="flex items-center justify-between p-3 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<span class="text-sm font-medium text-primary-content">
						{{ formatTechName(techId) }}
					</span>
					<button
						type="button"
						:disabled="isLoading === `tech-${techId}`"
						@click="unsubscribeTechnology(techId)"
						class="text-sm text-[var(--editorial-rust)] hover:opacity-80 font-medium disabled:opacity-50"
					>
						{{ isLoading === `tech-${techId}` ? "..." : "Unsubscribe" }}
					</button>
				</div>
			</div>
		</div>

		<!-- Communication Preferences Section -->
		<div>
			<h3
				class="text-sm font-semibold text-secondary-content uppercase tracking-wide mb-3"
			>
				Communication Preferences
			</h3>
			<div class="space-y-3">
				<!-- Marketing Emails -->
				<div
					class="flex items-center justify-between p-4 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-primary-content">
							Marketing Emails
						</h4>
						<p class="text-sm text-muted mt-1">
							Product announcements, promotions, and partner offers.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.marketingEmails" :disabled="isLoading === 'marketingEmails'" label="Toggle marketing emails" @change="togglePreference('marketingEmails', 'marketing', 'academy')" />
				</div>

				<!-- Service Notifications -->
				<div
					class="flex items-center justify-between p-4 rounded-sm bg-[var(--surface-card)] border border-[var(--surface-border)]"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-primary-content">
							Service Notifications
						</h4>
						<p class="text-sm text-muted mt-1">
							Account-related notifications like login alerts and security
							notices.
						</p>
					</div>
					<PreferenceSwitch :checked="preferences.serviceEmails" :disabled="isLoading === 'serviceEmails'" label="Toggle service notifications" @change="togglePreference('serviceEmails', 'service', 'academy')" />
				</div>
			</div>
		</div>

		<!-- Success Message -->
		<div
			v-if="showSuccess"
			class="flex items-center gap-2 p-3 rounded-sm bg-[var(--editorial-spruce-dim)] text-[var(--editorial-spruce)] text-sm"
		>
			<svg
				class="w-5 h-5 flex-shrink-0"
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
			class="flex items-center gap-2 p-3 rounded-sm bg-[var(--surface-card)] border border-[var(--editorial-rust)] text-[var(--editorial-rust)] text-sm"
		>
			<svg
				class="w-5 h-5 flex-shrink-0"
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
			class="pt-6 border-t border-[var(--surface-border)]"
			v-if="hasAnySubscription"
		>
			<Dialog.Root :open="showUnsubscribeConfirm" @open-change="showUnsubscribeConfirm = $event.open">
				<Dialog.Trigger class="text-sm text-muted hover:text-[var(--editorial-rust)] transition-colors">
					Unsubscribe from all emails
				</Dialog.Trigger>
				<Teleport to="body">
					<Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60" />
					<Dialog.Positioner class="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
						<Dialog.Content class="w-full max-w-lg p-5 rounded-sm bg-[var(--surface-card)] border border-[var(--editorial-rust)] shadow-xl">
							<Dialog.Title class="text-lg font-semibold text-primary-content">Unsubscribe from all emails?</Dialog.Title>
							<Dialog.Description class="text-sm text-[var(--editorial-rust)] my-3">
								You will stop receiving all newsletters and notifications from Rawkode Academy.
							</Dialog.Description>
							<div class="flex gap-3">
								<button type="button" :disabled="isUnsubscribingAll" @click="unsubscribeFromAll" class="px-4 py-2 text-sm font-medium text-[var(--surface-base)] bg-[var(--editorial-rust)] hover:opacity-90 rounded-sm disabled:opacity-50 disabled:cursor-wait">
									{{ isUnsubscribingAll ? "Unsubscribing..." : "Yes, unsubscribe" }}
								</button>
								<Dialog.CloseTrigger :disabled="isUnsubscribingAll" class="px-4 py-2 text-sm font-medium text-secondary-content hover:bg-[var(--surface-card-muted)] rounded-sm">Cancel</Dialog.CloseTrigger>
							</div>
						</Dialog.Content>
					</Dialog.Positioner>
				</Teleport>
			</Dialog.Root>
		</div>

		<!-- No Subscriptions Message -->
		<div
			v-if="!hasAnySubscription"
			class="text-center py-4 text-muted"
		>
			<p class="text-sm">You are not subscribed to any emails.</p>
			<a
				href="/"
				class="text-sm text-primary hover:underline mt-1 inline-block"
			>
				Explore content and subscribe
			</a>
		</div>
	</div>
</template>
