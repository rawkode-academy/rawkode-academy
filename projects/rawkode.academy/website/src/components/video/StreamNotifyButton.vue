<script setup lang="ts">
import { actions } from "astro:actions";
import {
	BellIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import { academyDocument } from "@rawkodeacademy/design-system";
import { getNotificationServiceWorkerRegistration } from "@/lib/notification-service-worker";

const props = defineProps<{
	videoSlug: string;
	publicKey: string;
}>();
const doc = academyDocument();

type NotifyState =
	| "checking"
	| "ready"
	| "unsupported"
	| "denied"
	| "loading"
	| "enabled"
	| "error";

const state = ref<NotifyState>("checking");
const message = ref<string | null>(null);

const isDisabled = computed(() =>
	["checking", "unsupported", "denied", "loading", "enabled"].includes(
		state.value,
	),
);

const buttonLabel = computed(() => {
	if (state.value === "loading") return "Enabling...";
	if (state.value === "enabled") return "Notifications on";
	if (state.value === "denied") return "Notifications blocked";
	if (state.value === "unsupported") return "Notifications unavailable";
	return "Notify me";
});

function subscriptionToInput(subscription: PushSubscription) {
	const serialized = subscription.toJSON();
	if (
		!serialized.endpoint ||
		!serialized.keys?.p256dh ||
		!serialized.keys.auth
	) {
		throw new Error("Browser returned an incomplete push subscription.");
	}

	return {
		endpoint: serialized.endpoint,
		expirationTime: serialized.expirationTime ?? null,
		keys: {
			p256dh: serialized.keys.p256dh,
			auth: serialized.keys.auth,
		},
	};
}

function base64UrlToUint8Array(value: string): Uint8Array {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);
	const output = new Uint8Array(raw.length);
	for (let index = 0; index < raw.length; index += 1) {
		output[index] = raw.charCodeAt(index);
	}
	return output;
}

function hasNotificationSupport(): boolean {
	return Boolean(props.publicKey && "Notification" in window);
}

function hasWebPushSupport(): boolean {
	return Boolean(
		props.publicKey &&
			window.isSecureContext &&
			"serviceWorker" in navigator &&
			"PushManager" in window &&
			"Notification" in window,
	);
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
	return getNotificationServiceWorkerRegistration(navigator.serviceWorker);
}

async function checkExistingSubscription() {
	if (!props.publicKey) {
		state.value = "unsupported";
		message.value = "Notifications are not configured yet.";
		return;
	}

	if (!hasNotificationSupport()) {
		state.value = "unsupported";
		message.value = "This browser cannot receive notifications.";
		return;
	}

	if (Notification.permission === "denied") {
		state.value = "denied";
		message.value = "Allow notifications in your browser settings to use this.";
		return;
	}

	if (Notification.permission !== "granted") {
		state.value = "ready";
		return;
	}

	if (!hasWebPushSupport()) {
		state.value = "unsupported";
		message.value = "This browser cannot receive push notifications.";
		return;
	}

	try {
		const registration = await getRegistration();
		const subscription = await registration.pushManager.getSubscription();
		if (!subscription) {
			state.value = "ready";
			return;
		}

		const { data, error } = await actions.streamNotifications.status({
			videoSlug: props.videoSlug,
			endpoint: subscription.endpoint,
		});
		if (error) throw new Error(error.message);
		state.value = data?.registered ? "enabled" : "ready";
	} catch {
		state.value = "ready";
	}
}

async function enableNotifications() {
	if (state.value === "loading" || state.value === "enabled") return;
	message.value = null;

	if (!props.publicKey) {
		state.value = "unsupported";
		message.value = "Notifications are not configured yet.";
		return;
	}

	if (!hasNotificationSupport()) {
		state.value = "unsupported";
		message.value = "This browser cannot receive notifications.";
		return;
	}

	if (Notification.permission === "denied") {
		state.value = "denied";
		message.value = "Allow notifications in your browser settings to use this.";
		return;
	}

	state.value = "loading";
	try {
		const permission =
			Notification.permission === "granted"
				? Notification.permission
				: await Notification.requestPermission();
		if (permission !== "granted") {
			state.value = permission === "denied" ? "denied" : "ready";
			message.value =
				permission === "denied"
					? "Allow notifications in your browser settings to use this."
					: "Notifications were not enabled.";
			return;
		}

		if (!hasWebPushSupport()) {
			state.value = "unsupported";
			message.value = "This browser cannot receive push notifications.";
			return;
		}

		const registration = await getRegistration();
		const subscription =
			(await registration.pushManager.getSubscription()) ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: base64UrlToUint8Array(props.publicKey),
			}));

		const { data, error } = await actions.streamNotifications.register({
			videoSlug: props.videoSlug,
			subscription: subscriptionToInput(subscription),
		});
		if (error) throw new Error(error.message);
		if (!data?.success) throw new Error("Notification registration failed.");

		state.value = "enabled";
		message.value = "We will notify you when this stream starts.";
	} catch (err: unknown) {
		state.value = "error";
		message.value =
			err instanceof Error
				? err.message
				: "Could not enable notifications. Try again in a moment.";
	}
}

onMounted(() => {
	checkExistingSubscription();
});
</script>

<template>
	<div :class="doc.stackSmall">
		<button
			type="button"
			:class="doc.button"
			:disabled="isDisabled"
			@click="enableNotifications"
		>
			<CheckCircleIcon v-if="state === 'enabled'" :class="doc.iconSmall" aria-hidden="true" />
			<ExclamationTriangleIcon
				v-else-if="state === 'unsupported' || state === 'denied' || state === 'error'"
				:class="doc.iconSmall"
				aria-hidden="true"
			/>
			<BellIcon v-else :class="doc.iconSmall" aria-hidden="true" />
			<span>{{ buttonLabel }}</span>
		</button>
		<p v-if="message" :class="doc.copy" role="status">
			{{ message }}
		</p>
	</div>
</template>
