<script setup lang="ts">
import { actions } from "astro:actions";
import {
	BellIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import { getNotificationServiceWorkerRegistration } from "@/lib/notification-service-worker";

const props = defineProps<{
	videoSlug: string;
	publicKey: string;
}>();

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
	<div class="stream-notify">
		<button
			type="button"
			class="stream-notify__button"
			:disabled="isDisabled"
			@click="enableNotifications"
		>
			<CheckCircleIcon v-if="state === 'enabled'" class="stream-notify__icon" aria-hidden="true" />
			<ExclamationTriangleIcon
				v-else-if="state === 'unsupported' || state === 'denied' || state === 'error'"
				class="stream-notify__icon"
				aria-hidden="true"
			/>
			<BellIcon v-else class="stream-notify__icon" aria-hidden="true" />
			<span>{{ buttonLabel }}</span>
		</button>
		<p v-if="message" class="stream-notify__message" role="status">
			{{ message }}
		</p>
	</div>
</template>

<style scoped>
	.stream-notify {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.stream-notify__button {
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border: 1px solid var(--editorial-ink);
		border-radius: var(--radius-sm);
		background: var(--editorial-ink);
		color: var(--editorial-paper);
		font-family: var(--font-inter-tight), sans-serif;
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
		transition:
			background var(--duration-base) var(--ease-standard),
			color var(--duration-base) var(--ease-standard),
			border-color var(--duration-base) var(--ease-standard);
	}

	.stream-notify__button:not(:disabled):hover {
		background: var(--editorial-spruce);
		border-color: var(--editorial-spruce);
	}

	.stream-notify__button:disabled {
		cursor: not-allowed;
		opacity: 0.72;
	}

	.stream-notify__icon {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}

	.stream-notify__message {
		margin: 0;
		max-width: 30rem;
		font-family: var(--font-inter-tight), sans-serif;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--editorial-ink-soft);
	}
</style>
