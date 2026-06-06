export interface PushSubscriptionInput {
	endpoint: string;
	expirationTime?: number | null | undefined;
	keys: {
		p256dh: string;
		auth: string;
	};
}

export interface NotificationIntentInput {
	dedupeKey: string;
	kind: string;
	subjectKey: string;
	title: string;
	body: string;
	url: string;
	tag: string;
	data?: Record<string, unknown>;
}

export interface RegisterNotificationInput {
	subscription: PushSubscriptionInput;
	notification: NotificationIntentInput;
	userId?: string;
	userAgent?: string;
}

export interface NotificationStatusInput {
	dedupeKey: string;
	endpoint: string;
}

export interface SendSubjectInput {
	subjectKey: string;
	title?: string;
	body?: string;
	url?: string;
	tag?: string;
	data?: Record<string, unknown>;
}

export interface NotificationPayload {
	title: string;
	body: string;
	tag: string;
	url: string;
	kind: string;
	data: Record<string, unknown>;
}

export interface PendingNotification {
	id: string;
	dedupeKey: string;
	kind: string;
	subjectKey: string;
	title: string;
	body: string;
	url: string;
	tag: string;
	dataJson: string;
	endpointHash: string;
	endpoint: string;
	p256dh: string;
	auth: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requireString(
	value: unknown,
	field: string,
	options: { url?: boolean } = {},
): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	const normalized = value.trim();
	if (options.url) {
		try {
			new URL(normalized);
		} catch {
			throw new Error(`${field} must be a valid URL`);
		}
	}
	return normalized;
}

function base64UrlToBytes(value: string, field: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(
		normalized.length + (4 - (normalized.length % 4 || 4)),
		"=",
	);
	try {
		const binary = atob(padded);
		const output = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			output[index] = binary.charCodeAt(index);
		}
		return output;
	} catch {
		throw new Error(`${field} must be base64url encoded`);
	}
}

function requirePushEndpoint(value: unknown): string {
	const endpoint = requireString(value, "subscription.endpoint", { url: true });
	const url = new URL(endpoint);
	if (url.protocol !== "https:") {
		throw new Error("subscription.endpoint must use https");
	}
	return endpoint;
}

function requireP256dh(value: unknown): string {
	const key = requireString(value, "subscription.keys.p256dh");
	const bytes = base64UrlToBytes(key, "subscription.keys.p256dh");
	if (bytes.byteLength !== 65 || bytes[0] !== 0x04) {
		throw new Error("subscription.keys.p256dh must be an uncompressed P-256 public key");
	}
	return key;
}

function requireAuthSecret(value: unknown): string {
	const auth = requireString(value, "subscription.keys.auth");
	const bytes = base64UrlToBytes(auth, "subscription.keys.auth");
	if (bytes.byteLength !== 16) {
		throw new Error("subscription.keys.auth must be a 16-byte authentication secret");
	}
	return auth;
}

export function assertPushSubscriptionInput(
	value: unknown,
): asserts value is PushSubscriptionInput {
	if (!isRecord(value)) {
		throw new Error("subscription must be an object");
	}
	requirePushEndpoint(value.endpoint);
	if (!isRecord(value.keys)) {
		throw new Error("subscription.keys is required");
	}
	requireP256dh(value.keys.p256dh);
	requireAuthSecret(value.keys.auth);
}

export function assertNotificationIntentInput(
	value: unknown,
): asserts value is NotificationIntentInput {
	if (!isRecord(value)) {
		throw new Error("notification must be an object");
	}
	requireString(value.dedupeKey, "notification.dedupeKey");
	requireString(value.kind, "notification.kind");
	requireString(value.subjectKey, "notification.subjectKey");
	requireString(value.title, "notification.title");
	requireString(value.body, "notification.body");
	requireString(value.url, "notification.url", { url: true });
	requireString(value.tag, "notification.tag");
	if (value.data !== undefined && !isRecord(value.data)) {
		throw new Error("notification.data must be an object");
	}
}

export function assertRegisterNotificationInput(
	value: unknown,
): asserts value is RegisterNotificationInput {
	if (!isRecord(value)) {
		throw new Error("input must be an object");
	}
	assertPushSubscriptionInput(value.subscription);
	assertNotificationIntentInput(value.notification);
	if (value.userId !== undefined && typeof value.userId !== "string") {
		throw new Error("userId must be a string");
	}
	if (value.userAgent !== undefined && typeof value.userAgent !== "string") {
		throw new Error("userAgent must be a string");
	}
}

export function assertNotificationStatusInput(
	value: unknown,
): asserts value is NotificationStatusInput {
	if (!isRecord(value)) {
		throw new Error("input must be an object");
	}
	requireString(value.dedupeKey, "dedupeKey");
	requireString(value.endpoint, "endpoint", { url: true });
}

export function assertSendSubjectInput(
	value: unknown,
): asserts value is SendSubjectInput {
	if (!isRecord(value)) {
		throw new Error("input must be an object");
	}
	requireString(value.subjectKey, "subjectKey");
	if (value.title !== undefined) requireString(value.title, "title");
	if (value.body !== undefined) requireString(value.body, "body");
	if (value.url !== undefined) requireString(value.url, "url", { url: true });
	if (value.tag !== undefined) requireString(value.tag, "tag");
	if (value.data !== undefined && !isRecord(value.data)) {
		throw new Error("data must be an object");
	}
}

export function notificationId(
	dedupeKey: string,
	endpointHash: string,
): string {
	return `${dedupeKey}:${endpointHash}`;
}

export function createNotificationPayload(
	notification:
		| NotificationIntentInput
		| Pick<
				PendingNotification,
				"title" | "body" | "tag" | "url" | "kind" | "dataJson"
		  >,
): NotificationPayload {
	const data =
		"dataJson" in notification
			? parseDataJson(notification.dataJson)
			: (notification.data ?? {});

	return {
		title: notification.title,
		body: notification.body,
		tag: notification.tag,
		url: notification.url,
		kind: notification.kind,
		data,
	};
}

function parseDataJson(dataJson: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(dataJson);
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}
