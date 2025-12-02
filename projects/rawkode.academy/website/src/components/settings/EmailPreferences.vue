<script setup lang="ts">
import { ref, computed } from "vue";
import { actions } from "astro:actions";

const props = defineProps<{
	academyNewsletter: boolean;
	matrixNewsletter: boolean;
	marketingEmails: boolean;
	serviceEmails: boolean;
	technologySubscriptions: string[];
}>();

const preferences = ref({
	academyNewsletter: props.academyNewsletter,
	matrixNewsletter: props.matrixNewsletter,
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
				class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide mb-3"
			>
				Newsletters
			</h3>
			<div class="space-y-3">
				<!-- Academy Newsletter -->
				<div
					class="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-neutral-900 dark:text-white">
							Academy Newsletter
						</h4>
						<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
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
							'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
							preferences.academyNewsletter
								? 'bg-primary'
								: 'bg-neutral-300 dark:bg-neutral-700',
							isLoading === 'academyNewsletter' ? 'opacity-50 cursor-wait' : '',
						]"
						role="switch"
						:aria-checked="preferences.academyNewsletter"
					>
						<span class="sr-only">Toggle academy newsletter</span>
						<span
							:class="[
								'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
								preferences.academyNewsletter
									? 'translate-x-5'
									: 'translate-x-0',
							]"
						/>
					</button>
				</div>

				<!-- Technology Matrix Updates -->
				<div
					class="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-neutral-900 dark:text-white">
							Technology Matrix Updates
						</h4>
						<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
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
							'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
							preferences.matrixNewsletter
								? 'bg-primary'
								: 'bg-neutral-300 dark:bg-neutral-700',
							isLoading === 'matrixNewsletter' ? 'opacity-50 cursor-wait' : '',
						]"
						role="switch"
						:aria-checked="preferences.matrixNewsletter"
					>
						<span class="sr-only">Toggle matrix updates</span>
						<span
							:class="[
								'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
								preferences.matrixNewsletter
									? 'translate-x-5'
									: 'translate-x-0',
							]"
						/>
					</button>
				</div>
			</div>
		</div>

		<!-- Technology-Specific Subscriptions -->
		<div v-if="techSubs.length > 0">
			<h3
				class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide mb-3"
			>
				Technology Updates
			</h3>
			<div class="space-y-2">
				<div
					v-for="techId in techSubs"
					:key="techId"
					class="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800"
				>
					<span class="text-sm font-medium text-neutral-900 dark:text-white">
						{{ formatTechName(techId) }}
					</span>
					<button
						type="button"
						:disabled="isLoading === `tech-${techId}`"
						@click="unsubscribeTechnology(techId)"
						class="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium disabled:opacity-50"
					>
						{{ isLoading === `tech-${techId}` ? "..." : "Unsubscribe" }}
					</button>
				</div>
			</div>
		</div>

		<!-- Communication Preferences Section -->
		<div>
			<h3
				class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide mb-3"
			>
				Communication Preferences
			</h3>
			<div class="space-y-3">
				<!-- Marketing Emails -->
				<div
					class="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-neutral-900 dark:text-white">
							Marketing Emails
						</h4>
						<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
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
							'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
							preferences.marketingEmails
								? 'bg-primary'
								: 'bg-neutral-300 dark:bg-neutral-700',
							isLoading === 'marketingEmails' ? 'opacity-50 cursor-wait' : '',
						]"
						role="switch"
						:aria-checked="preferences.marketingEmails"
					>
						<span class="sr-only">Toggle marketing emails</span>
						<span
							:class="[
								'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
								preferences.marketingEmails ? 'translate-x-5' : 'translate-x-0',
							]"
						/>
					</button>
				</div>

				<!-- Service Notifications -->
				<div
					class="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-800"
				>
					<div class="flex-1 pr-4">
						<h4 class="text-base font-medium text-neutral-900 dark:text-white">
							Service Notifications
						</h4>
						<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
							Account-related notifications like login alerts and security
							notices.
						</p>
					</div>
					<button
						type="button"
						:disabled="isLoading === 'serviceEmails'"
						@click="togglePreference('serviceEmails', 'service', 'academy')"
						:class="[
							'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
							preferences.serviceEmails
								? 'bg-primary'
								: 'bg-neutral-300 dark:bg-neutral-700',
							isLoading === 'serviceEmails' ? 'opacity-50 cursor-wait' : '',
						]"
						role="switch"
						:aria-checked="preferences.serviceEmails"
					>
						<span class="sr-only">Toggle service notifications</span>
						<span
							:class="[
								'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
								preferences.serviceEmails ? 'translate-x-5' : 'translate-x-0',
							]"
						/>
					</button>
				</div>
			</div>
		</div>

		<!-- Success Message -->
		<div
			v-if="showSuccess"
			class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm"
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
			class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
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
			class="pt-6 border-t border-neutral-200 dark:border-neutral-800"
			v-if="hasAnySubscription"
		>
			<div v-if="!showUnsubscribeConfirm">
				<button
					type="button"
					@click="showUnsubscribeConfirm = true"
					class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
				>
					Unsubscribe from all emails
				</button>
			</div>
			<div
				v-else
				class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
			>
				<p class="text-sm text-red-700 dark:text-red-300 mb-3">
					Are you sure you want to unsubscribe from all emails? You will stop
					receiving all newsletters and notifications from Rawkode Academy.
				</p>
				<div class="flex gap-3">
					<button
						type="button"
						:disabled="isUnsubscribingAll"
						@click="unsubscribeFromAll"
						class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-wait"
					>
						{{ isUnsubscribingAll ? "Unsubscribing..." : "Yes, unsubscribe" }}
					</button>
					<button
						type="button"
						:disabled="isUnsubscribingAll"
						@click="showUnsubscribeConfirm = false"
						class="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>

		<!-- No Subscriptions Message -->
		<div
			v-if="!hasAnySubscription"
			class="text-center py-4 text-neutral-500 dark:text-neutral-400"
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
