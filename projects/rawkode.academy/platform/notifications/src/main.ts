import { WorkerEntrypoint } from "cloudflare:workers";
import {
	assertNotificationStatusInput,
	assertRegisterNotificationInput,
	assertSendSubjectInput,
	createNotificationPayload,
	notificationId,
	type NotificationStatusInput,
	type PendingNotification,
	type RegisterNotificationInput,
	type SendSubjectInput,
} from "./contracts.js";
import {
	sendWebPush,
	WebPushSubscriptionExpiredError,
	type WebPushConfig,
} from "./web-push.js";

export interface Env {
	DB: D1Database;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string | SecretsStoreSecret;
	VAPID_SUBJECT: string;
}

const SEND_BATCH_SIZE = 500;
const CLAIM_STALE_AFTER_SECONDS = 15 * 60;
const FAILED_RETRY_AFTER_SECONDS = 60;
const QUEUE_RETRY_DELAY_SECONDS = 60;

interface RegisterResult {
	success: true;
	status: "registered";
	alreadyRegistered: boolean;
}

interface StatusResult {
	registered: boolean;
}

interface CancelResult {
	success: true;
	wasRegistered: boolean;
}

interface SendSubjectResult {
	success: true;
	checked: number;
	sent: number;
	failed: number;
	expired: number;
}

interface ClaimedSend {
	id: string;
	attemptId: string;
}

async function readSecretString(
	value: string | SecretsStoreSecret | undefined,
): Promise<string | null> {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "string") return null;
	const secret = await value?.get();
	return typeof secret === "string" && secret.trim() ? secret.trim() : null;
}

async function getWebPushConfig(env: Env): Promise<WebPushConfig> {
	const privateKey = await readSecretString(env.VAPID_PRIVATE_KEY);
	if (!env.VAPID_PUBLIC_KEY || !privateKey) {
		throw new Error("VAPID keys are not configured");
	}
	return {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey,
		subject: env.VAPID_SUBJECT || "mailto:david@rawkode.email",
	};
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function registerNotification(
	env: Env,
	input: RegisterNotificationInput,
): Promise<RegisterResult> {
	assertRegisterNotificationInput(input);

	const endpointHash = await sha256Hex(input.subscription.endpoint);
	const id = notificationId(input.notification.dedupeKey, endpointHash);
	const existing = await env.DB.prepare(
		`SELECT cancelled_at
		   FROM notification_intents
		  WHERE id = ?
		  LIMIT 1`,
	)
		.bind(id)
		.first<{ cancelled_at: number | null }>();
	const alreadyRegistered = existing?.cancelled_at === null;

	await env.DB.prepare(
		`INSERT INTO push_subscriptions (
			endpoint_hash, endpoint, p256dh, auth, user_id, user_agent, created_at, updated_at, disabled_at, last_error
		) VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), NULL, NULL)
		ON CONFLICT(endpoint_hash) DO UPDATE SET
			endpoint = excluded.endpoint,
			p256dh = excluded.p256dh,
			auth = excluded.auth,
			user_id = COALESCE(excluded.user_id, push_subscriptions.user_id),
			user_agent = COALESCE(excluded.user_agent, push_subscriptions.user_agent),
			updated_at = unixepoch(),
			disabled_at = NULL,
			last_error = NULL`,
	)
		.bind(
			endpointHash,
			input.subscription.endpoint,
			input.subscription.keys.p256dh,
			input.subscription.keys.auth,
			input.userId ?? null,
			input.userAgent ?? null,
		)
		.run();

	await env.DB.prepare(
		`INSERT INTO notification_intents (
			id, dedupe_key, kind, subject_key, title, body, url, tag, data_json, endpoint_hash, created_at, updated_at, cancelled_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), NULL)
		ON CONFLICT(dedupe_key, endpoint_hash) DO UPDATE SET
			kind = excluded.kind,
			subject_key = excluded.subject_key,
			title = excluded.title,
			body = excluded.body,
			url = excluded.url,
			tag = excluded.tag,
			data_json = excluded.data_json,
			updated_at = unixepoch(),
			cancelled_at = NULL`,
	)
		.bind(
			id,
			input.notification.dedupeKey,
			input.notification.kind,
			input.notification.subjectKey,
			input.notification.title,
			input.notification.body,
			input.notification.url,
			input.notification.tag,
			JSON.stringify(input.notification.data ?? {}),
			endpointHash,
		)
		.run();

	return {
		success: true,
		status: "registered",
		alreadyRegistered,
	};
}

export async function getNotificationStatus(
	env: Env,
	input: NotificationStatusInput,
): Promise<StatusResult> {
	assertNotificationStatusInput(input);
	const endpointHash = await sha256Hex(input.endpoint);
	const row = await env.DB.prepare(
		`SELECT n.id
		   FROM notification_intents n
		   JOIN push_subscriptions s ON s.endpoint_hash = n.endpoint_hash
		  WHERE n.dedupe_key = ?
		    AND n.endpoint_hash = ?
		    AND n.cancelled_at IS NULL
		    AND s.disabled_at IS NULL
		  LIMIT 1`,
	)
		.bind(input.dedupeKey, endpointHash)
		.first();

	return { registered: Boolean(row) };
}

export async function cancelNotification(
	env: Env,
	input: NotificationStatusInput,
): Promise<CancelResult> {
	assertNotificationStatusInput(input);
	const endpointHash = await sha256Hex(input.endpoint);
	const result = await env.DB.prepare(
		`UPDATE notification_intents
		    SET cancelled_at = unixepoch(),
		        updated_at = unixepoch()
		  WHERE dedupe_key = ?
		    AND endpoint_hash = ?
		    AND cancelled_at IS NULL`,
	)
		.bind(input.dedupeKey, endpointHash)
		.run();

	return {
		success: true,
		wasRegistered: result.meta.changes > 0,
	};
}

function applySendOverrides(
	notification: PendingNotification,
	input: SendSubjectInput,
) {
	const payload = createNotificationPayload(notification);
	return {
		...payload,
		title: input.title ?? payload.title,
		body: input.body ?? payload.body,
		url: input.url ?? payload.url,
		tag: input.tag ?? payload.tag,
		data: {
			...payload.data,
			...(input.data ?? {}),
		},
	};
}

async function listSubjectNotifications(
	env: Env,
	subjectKey: string,
	limit = SEND_BATCH_SIZE,
): Promise<PendingNotification[]> {
	const { results } = await env.DB.prepare(
		`SELECT
        n.id,
        n.dedupe_key AS dedupeKey,
        n.kind,
        n.subject_key AS subjectKey,
        n.title,
        n.body,
        n.url,
        n.tag,
        n.data_json AS dataJson,
        n.endpoint_hash AS endpointHash,
        s.endpoint,
        s.p256dh,
        s.auth
      FROM notification_intents n
      JOIN push_subscriptions s ON s.endpoint_hash = n.endpoint_hash
      WHERE n.cancelled_at IS NULL
        AND s.disabled_at IS NULL
        AND n.subject_key = ?
        AND NOT EXISTS (
          SELECT 1
          FROM notification_sends sent
			WHERE sent.notification_id = n.id
			  AND (
			    sent.status = 'sent'
			    OR (sent.status = 'claimed' AND sent.sent_at > unixepoch() - ?)
			    OR (sent.status = 'failed' AND sent.sent_at > unixepoch() - ?)
			  )
		  )
		  ORDER BY n.created_at ASC
      LIMIT ?`,
	)
		.bind(
			subjectKey,
			CLAIM_STALE_AFTER_SECONDS,
			FAILED_RETRY_AFTER_SECONDS,
			limit,
		)
		.all<PendingNotification>();

	return results ?? [];
}

async function claimNotificationSend(
	env: Env,
	notification: PendingNotification,
): Promise<ClaimedSend | null> {
	const sendId = notificationId(notification.id, notification.endpointHash);
	const attemptId = crypto.randomUUID();
	const result = await env.DB.prepare(
		`INSERT OR IGNORE INTO notification_sends (
			id, notification_id, dedupe_key, endpoint_hash, sent_at, status, attempt_id, attempts
		) VALUES (?, ?, ?, ?, unixepoch(), 'claimed', ?, 1)`,
	)
		.bind(
			sendId,
			notification.id,
			notification.dedupeKey,
			notification.endpointHash,
			attemptId,
		)
		.run();
	if (result.meta.changes > 0) return { id: sendId, attemptId };

	const retry = await env.DB.prepare(
		`UPDATE notification_sends
		    SET status = 'claimed',
		        sent_at = unixepoch(),
		        push_status = NULL,
		        error = NULL,
		        attempt_id = ?,
		        attempts = attempts + 1
		  WHERE notification_id = ?
		    AND (
		        (status = 'failed' AND sent_at <= unixepoch() - ?)
		        OR (status = 'claimed' AND sent_at <= unixepoch() - ?)
		    )`,
	)
		.bind(
			attemptId,
			notification.id,
			FAILED_RETRY_AFTER_SECONDS,
			CLAIM_STALE_AFTER_SECONDS,
		)
		.run();
	return retry.meta.changes > 0 ? { id: sendId, attemptId } : null;
}

async function updateSendStatus(
	env: Env,
	notification: PendingNotification,
	claim: ClaimedSend,
	status: "sent" | "failed",
	fields: { pushStatus?: number; error?: string } = {},
): Promise<boolean> {
	const result = await env.DB.prepare(
		`UPDATE notification_sends
		    SET status = ?,
		        push_status = ?,
		        error = ?,
		        sent_at = unixepoch()
		  WHERE notification_id = ?
		    AND attempt_id = ?
		    AND status = 'claimed'`,
	)
		.bind(
			status,
			fields.pushStatus ?? null,
			fields.error ?? null,
			notification.id,
			claim.attemptId,
		)
		.run();
	return result.meta.changes > 0;
}

async function disableSubscription(
	env: Env,
	notification: PendingNotification,
	error: string,
): Promise<void> {
	await env.DB.prepare(
		`UPDATE push_subscriptions
		    SET disabled_at = unixepoch(),
		        last_error = ?,
		        updated_at = unixepoch()
		  WHERE endpoint_hash = ?`,
	)
		.bind(error, notification.endpointHash)
		.run();
}

export async function sendSubjectNotifications(
	env: Env,
	input: SendSubjectInput,
): Promise<SendSubjectResult> {
	assertSendSubjectInput(input);
	const webPushConfig = await getWebPushConfig(env);

	let checked = 0;
	let sent = 0;
	let failed = 0;
	let expired = 0;

	for (;;) {
		const notifications = await listSubjectNotifications(env, input.subjectKey);
		if (notifications.length === 0) break;
		checked += notifications.length;

		for (const notification of notifications) {
			const claim = await claimNotificationSend(env, notification);
			if (!claim) continue;

			try {
				const result = await sendWebPush(
					{
						endpoint: notification.endpoint,
						keys: {
							p256dh: notification.p256dh,
							auth: notification.auth,
						},
					},
					applySendOverrides(notification, input),
					webPushConfig,
				);
				const updated = await updateSendStatus(env, notification, claim, "sent", {
					pushStatus: result.status,
				});
				if (updated) sent += 1;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (error instanceof WebPushSubscriptionExpiredError) {
					const updated = await updateSendStatus(env, notification, claim, "failed", {
						pushStatus: error.status,
						error: message,
					});
					if (updated) {
						expired += 1;
						await disableSubscription(env, notification, message);
					}
				} else {
					const updated = await updateSendStatus(env, notification, claim, "failed", {
						error: message,
					});
					if (updated) failed += 1;
				}
			}
		}
	}

	return {
		success: true,
		checked,
		sent,
		failed,
		expired,
	};
}

export class Notifications extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}
		return new Response("Not Found", { status: 404 });
	}

	async registerNotification(
		input: RegisterNotificationInput,
	): Promise<RegisterResult> {
		return registerNotification(this.env, input);
	}

	async getNotificationStatus(
		input: NotificationStatusInput,
	): Promise<StatusResult> {
		return getNotificationStatus(this.env, input);
	}

	async cancelNotification(input: NotificationStatusInput): Promise<CancelResult> {
		return cancelNotification(this.env, input);
	}

	async sendSubjectNotifications(
		input: SendSubjectInput,
	): Promise<SendSubjectResult> {
		return sendSubjectNotifications(this.env, input);
	}
}

async function processQueuedNotification(
	env: Env,
	message: Message<SendSubjectInput>,
): Promise<void> {
	try {
		const result = await sendSubjectNotifications(env, message.body);
		console.log(
			JSON.stringify({
				event: "stream_notifications_sent",
				messageId: message.id,
				queueAttempts: message.attempts,
				...result,
			}),
		);
		if (result.failed > 0) {
			message.retry({ delaySeconds: QUEUE_RETRY_DELAY_SECONDS });
			return;
		}
		message.ack();
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "stream_notifications_queue_failed",
				messageId: message.id,
				queueAttempts: message.attempts,
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		message.retry({ delaySeconds: QUEUE_RETRY_DELAY_SECONDS });
	}
}

export default {
	fetch(request: Request) {
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}
		return new Response("Not Found", { status: 404 });
	},

	async queue(batch: MessageBatch<SendSubjectInput>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			await processQueuedNotification(env, message);
		}
	},
} satisfies ExportedHandler<Env, SendSubjectInput>;
