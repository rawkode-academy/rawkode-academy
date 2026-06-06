import { beforeEach, describe, expect, it, vi } from "vitest";

const sendWebPush = vi.hoisted(() => vi.fn());

vi.mock("cloudflare:workers", () => ({
	WorkerEntrypoint: class MockWorkerEntrypoint<T> {
		env: T;
		constructor() {
			this.env = {} as T;
		}
	},
}));

vi.mock("../src/web-push.js", () => ({
	sendWebPush,
	WebPushSubscriptionExpiredError: class WebPushSubscriptionExpiredError extends Error {
		constructor(
			message: string,
			readonly status: number,
		) {
			super(message);
			this.name = "WebPushSubscriptionExpiredError";
		}
	},
}));

import {
	default as worker,
	getNotificationStatus,
	sendSubjectNotifications,
	type Env,
} from "../src/main.js";
import type { SendSubjectInput } from "../src/contracts.js";

interface StoredIntent {
	id: string;
	dedupe_key: string;
	kind: string;
	subject_key: string;
	title: string;
	body: string;
	url: string;
	tag: string;
	data_json: string;
	endpoint_hash: string;
	cancelled_at: number | null;
	created_at: number;
}

interface StoredSubscription {
	endpoint_hash: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	disabled_at: number | null;
}

interface StoredSend {
	id: string;
	notification_id: string;
	dedupe_key: string;
	endpoint_hash: string;
	sent_at: number;
	status: "claimed" | "failed" | "sent";
	attempt_id: string | null;
	attempts: number;
	push_status?: number | null;
	error?: string | null;
}

const p256dh =
	"BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const auth = "AQEBAQEBAQEBAQEBAQEBAQ";

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

class FakeStatement {
	private values: unknown[] = [];

	constructor(
		private readonly db: FakeD1Database,
		private readonly sql: string,
	) {}

	bind(...values: unknown[]) {
		this.values = values;
		return this;
	}

	async first() {
		if (
			this.sql.includes("FROM notification_intents n") &&
			this.sql.includes("JOIN push_subscriptions")
		) {
			const [dedupeKey, endpointHash] = this.values;
			const intent = [...this.db.intents.values()].find(
				(row) =>
					row.dedupe_key === dedupeKey &&
					row.endpoint_hash === endpointHash &&
					row.cancelled_at === null,
			);
			if (!intent) return null;
			const subscription = this.db.subscriptions.get(intent.endpoint_hash);
			return subscription?.disabled_at === null ? { id: intent.id } : null;
		}
		throw new Error(`Unhandled first query: ${this.sql}`);
	}

	async all() {
		if (
			this.sql.includes("FROM notification_intents n") &&
			this.sql.includes("JOIN push_subscriptions")
		) {
			const [
				subjectKey,
				claimStaleAfterSeconds,
				failedRetryAfterSeconds,
				limit,
			] = this.values as [string, number, number, number];
			const results = [...this.db.intents.values()]
				.filter((intent) => intent.subject_key === subjectKey)
				.filter((intent) => intent.cancelled_at === null)
				.filter((intent) => {
					const subscription = this.db.subscriptions.get(intent.endpoint_hash);
					return subscription?.disabled_at === null;
				})
				.filter((intent) => {
					const send = this.db.sendForNotification(intent.id);
					if (!send) return true;
					if (send.status === "sent") return false;
					if (send.status === "failed") {
						return send.sent_at <= this.db.now - failedRetryAfterSeconds;
					}
					const fresh =
						send.sent_at > this.db.now - claimStaleAfterSeconds;
					return !fresh;
				})
				.sort((left, right) => left.created_at - right.created_at)
				.slice(0, limit)
				.map((intent) => {
					const subscription = this.db.subscriptions.get(intent.endpoint_hash);
					if (!subscription) throw new Error("missing subscription");
					return {
						id: intent.id,
						dedupeKey: intent.dedupe_key,
						kind: intent.kind,
						subjectKey: intent.subject_key,
						title: intent.title,
						body: intent.body,
						url: intent.url,
						tag: intent.tag,
						dataJson: intent.data_json,
						endpointHash: intent.endpoint_hash,
						endpoint: subscription.endpoint,
						p256dh: subscription.p256dh,
						auth: subscription.auth,
					};
				});

			return { results };
		}
		throw new Error(`Unhandled all query: ${this.sql}`);
	}

	async run() {
		if (this.sql.includes("INSERT OR IGNORE INTO notification_sends")) {
			const [id, notificationId, dedupeKey, endpointHash, attemptId] =
				this.values as [string, string, string, string, string];
			if (this.db.sendForNotification(notificationId)) {
				return { meta: { changes: 0 } };
			}
			this.db.sends.set(id, {
				id,
				notification_id: notificationId,
				dedupe_key: dedupeKey,
				endpoint_hash: endpointHash,
				sent_at: this.db.now,
				status: "claimed",
				attempt_id: attemptId,
				attempts: 1,
			});
			return { meta: { changes: 1 } };
		}

		if (this.sql.includes("attempts = attempts + 1")) {
			const [
				attemptId,
				notificationId,
				failedRetryAfterSeconds,
				claimStaleAfterSeconds,
			] = this.values as [string, string, number, number];
			const send = this.db.sendForNotification(notificationId);
			if (!send) return { meta: { changes: 0 } };
			const retryable =
				(send.status === "failed" &&
					send.sent_at <= this.db.now - failedRetryAfterSeconds) ||
				(send.status === "claimed" &&
					send.sent_at <= this.db.now - claimStaleAfterSeconds);
			if (!retryable) return { meta: { changes: 0 } };

			send.status = "claimed";
			send.sent_at = this.db.now;
			send.push_status = null;
			send.error = null;
			send.attempt_id = attemptId;
			send.attempts += 1;
			return { meta: { changes: 1 } };
		}

		if (this.sql.includes("UPDATE notification_sends")) {
			const [status, pushStatus, error, notificationId, attemptId] =
				this.values as [
					"sent" | "failed",
					number | null,
					string | null,
					string,
					string,
				];
			this.db.beforeStatusUpdate?.();
			const send = this.db.sendForNotification(notificationId);
			if (
				!send ||
				send.status !== "claimed" ||
				send.attempt_id !== attemptId
			) {
				return { meta: { changes: 0 } };
			}
			send.status = status;
			send.push_status = pushStatus;
			send.error = error;
			send.sent_at = this.db.now;
			return { meta: { changes: 1 } };
		}

		if (this.sql.includes("UPDATE push_subscriptions")) {
			const [error, endpointHash] = this.values as [string, string];
			const subscription = this.db.subscriptions.get(endpointHash);
			if (!subscription) return { meta: { changes: 0 } };
			subscription.disabled_at = this.db.now;
			this.db.lastSubscriptionError = error;
			return { meta: { changes: 1 } };
		}

		throw new Error(`Unhandled run query: ${this.sql}`);
	}
}

class FakeD1Database {
	now = 1_000;
	intents = new Map<string, StoredIntent>();
	subscriptions = new Map<string, StoredSubscription>();
	sends = new Map<string, StoredSend>();
	beforeStatusUpdate: (() => void) | null = null;
	lastSubscriptionError: string | null = null;

	prepare(sql: string) {
		return new FakeStatement(this, sql);
	}

	sendForNotification(notificationId: string) {
		return [...this.sends.values()].find(
			(send) => send.notification_id === notificationId,
		);
	}
}

async function createEnv(disabled = false) {
	const endpoint = "https://push.example.test/send/123";
	const endpointHash = await sha256Hex(endpoint);
	const db = new FakeD1Database();
	db.subscriptions.set(endpointHash, {
		endpoint_hash: endpointHash,
		endpoint,
		p256dh,
		auth,
		disabled_at: disabled ? db.now : null,
	});
	db.intents.set("notification-1", {
		id: "notification-1",
		dedupe_key: "stream:test:live-start",
		kind: "stream-started",
		subject_key: "stream:test",
		title: "Stream is live",
		body: "The stream has started.",
		url: "https://rawkode.academy/watch/test",
		tag: "stream:test",
		data_json: "{}",
		endpoint_hash: endpointHash,
		cancelled_at: null,
		created_at: db.now,
	});
	const env = {
		DB: db as unknown as D1Database,
		VAPID_PUBLIC_KEY: "public-key",
		VAPID_PRIVATE_KEY: "private-key",
		VAPID_SUBJECT: "mailto:david@rawkode.email",
	} satisfies Env;
	return { db, endpoint, env };
}

describe("notifications worker", () => {
	beforeEach(() => {
		sendWebPush.mockReset();
	});

	it("does not report disabled subscriptions as registered", async () => {
		const { endpoint, env } = await createEnv(true);

		await expect(
			getNotificationStatus(env, {
				dedupeKey: "stream:test:live-start",
				endpoint,
			}),
		).resolves.toEqual({ registered: false });
	});

	it("leaves transient send failures retryable for a later queue attempt", async () => {
		const { db, env } = await createEnv();
		sendWebPush.mockRejectedValueOnce(new Error("temporary push failure"));

		await expect(
			sendSubjectNotifications(env, { subjectKey: "stream:test" }),
		).resolves.toMatchObject({
			success: true,
			checked: 1,
			failed: 1,
			sent: 0,
		});
		expect(sendWebPush).toHaveBeenCalledTimes(1);
		expect(db.sendForNotification("notification-1")).toMatchObject({
			status: "failed",
			attempts: 1,
		});

		db.now += 61;
		sendWebPush.mockResolvedValueOnce({ status: 201 });
		await expect(
			sendSubjectNotifications(env, { subjectKey: "stream:test" }),
		).resolves.toMatchObject({
			success: true,
			checked: 1,
			failed: 0,
			sent: 1,
		});
		expect(sendWebPush).toHaveBeenCalledTimes(2);
		expect(db.sendForNotification("notification-1")).toMatchObject({
			status: "sent",
			attempts: 2,
		});
	});

	it("does not retry slow transient failures in the same fan-out pass", async () => {
		const { db, env } = await createEnv();
		sendWebPush.mockImplementationOnce(async () => {
			db.now += 61;
			throw new Error("slow push failure");
		});

		await expect(
			sendSubjectNotifications(env, { subjectKey: "stream:test" }),
		).resolves.toMatchObject({
			success: true,
			checked: 1,
			failed: 1,
			sent: 0,
		});

		expect(sendWebPush).toHaveBeenCalledTimes(1);
		expect(db.sendForNotification("notification-1")).toMatchObject({
			status: "failed",
			attempts: 1,
			sent_at: db.now,
		});
	});

	it("does not let a stale attempt overwrite a newer send result", async () => {
		const { db, env } = await createEnv();
		sendWebPush.mockResolvedValueOnce({ status: 201 });
		db.beforeStatusUpdate = () => {
			const send = db.sendForNotification("notification-1");
			if (!send) return;
			send.status = "sent";
			send.attempt_id = "newer-attempt";
		};

		await expect(
			sendSubjectNotifications(env, { subjectKey: "stream:test" }),
		).resolves.toMatchObject({
			success: true,
			checked: 1,
			sent: 0,
		});
		expect(db.sendForNotification("notification-1")).toMatchObject({
			status: "sent",
			attempt_id: "newer-attempt",
		});
	});

	it("marks queue messages for retry when delivery has transient failures", async () => {
		const { env } = await createEnv();
		sendWebPush.mockRejectedValueOnce(new Error("temporary push failure"));
		const message = {
			id: "message-1",
			timestamp: new Date(),
			body: { subjectKey: "stream:test" },
			attempts: 1,
			ack: vi.fn(),
			retry: vi.fn(),
		};

		await worker.queue(
			{
				queue: "rawkode-academy-notifications",
				messages: [message],
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} as unknown as MessageBatch<SendSubjectInput>,
			env,
		);

		expect(message.ack).not.toHaveBeenCalled();
		expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
	});
});
