import { describe, expect, it } from "vitest";
import {
	isRealtimeKitLiveStartEvent,
	realtimeKitNotificationData,
	realtimeKitVideoMatchesPayload,
	verifyRealtimeKitWebhookSignature,
} from "@/lib/realtimekit-webhooks";
import { POST as realtimeKitStreamStartedWebhook } from "@/pages/api/webhooks/realtimekit/stream-started";

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function spkiToPem(spki: ArrayBuffer): string {
	const base64 = bytesToBase64(new Uint8Array(spki));
	const lines = base64.match(/.{1,64}/g) ?? [];
	return [
		"-----BEGIN PUBLIC KEY-----",
		...lines,
		"-----END PUBLIC KEY-----",
	].join("\n");
}

describe("RealtimeKit webhook helpers", () => {
	it("ignores meeting.started because the livestream may not be live yet", () => {
		expect(
			isRealtimeKitLiveStartEvent({
				event: "meeting.started",
				meeting: {
					id: "meeting-123",
					sessionId: "session-123",
					status: "LIVE",
				},
			}),
		).toBe(false);
	});

	it("accepts live livestream status updates", () => {
		expect(
			isRealtimeKitLiveStartEvent({
				event: "livestreaming.statusUpdate",
				streamId: "stream-123",
				status: "LIVE",
			}),
		).toBe(true);
	});

	it("ignores offline livestream status updates", () => {
		expect(
			isRealtimeKitLiveStartEvent({
				event: "livestreaming.statusUpdate",
				streamId: "stream-123",
				status: "OFFLINE",
			}),
		).toBe(false);
	});

	it("builds notification metadata without undefined values", () => {
		expect(
			realtimeKitNotificationData({
				event: "meeting.started",
				meeting: {
					id: "meeting-123",
					sessionId: "session-123",
				},
			}),
		).toEqual({
			realtimeKitEvent: "meeting.started",
			realtimeKitMeetingId: "meeting-123",
			realtimeKitSessionId: "session-123",
		});
	});

	it("matches a live video by explicit RealtimeKit stream id", () => {
		expect(
			realtimeKitVideoMatchesPayload(
				{
					slug: "hands-on-introduction-to-iroh",
					realtimeKit: { streamId: "stream-123" },
				},
				{
					event: "livestreaming.statusUpdate",
					streamId: "stream-123",
					status: "LIVE",
				},
			),
		).toBe(true);
	});

	it("matches a live video by fetched livestream name", () => {
		expect(
			realtimeKitVideoMatchesPayload(
				{ slug: "hands-on-introduction-to-iroh" },
				{
					event: "livestreaming.statusUpdate",
					streamId: "stream-123",
					status: "LIVE",
				},
				{
					id: "stream-123",
					name: "hands-on-introduction-to-iroh",
					status: "LIVE",
				},
			),
		).toBe(true);
	});

	it("does not match unrelated RealtimeKit streams", () => {
		expect(
			realtimeKitVideoMatchesPayload(
				{
					slug: "hands-on-introduction-to-iroh",
					realtimeKit: { streamId: "stream-123" },
				},
				{
					event: "livestreaming.statusUpdate",
					streamId: "stream-456",
					status: "LIVE",
				},
				{
					id: "stream-456",
					name: "hands-on-introduction-to-yoke",
					status: "LIVE",
				},
			),
		).toBe(false);
	});

	it("verifies RealtimeKit RSA webhook signatures", async () => {
		const payload = {
			event: "livestreaming.statusUpdate",
			streamId: "stream-123",
			status: "LIVE",
		};
		const payloadText = JSON.stringify(payload);
		const keyPair = (await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		const signature = await crypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			keyPair.privateKey,
			new TextEncoder().encode(payloadText),
		);
		const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);

		expect(
			await verifyRealtimeKitWebhookSignature(
				payload,
				bytesToBase64(new Uint8Array(signature)),
				spkiToPem(publicKey),
			),
		).toBe(true);
		expect(
			await verifyRealtimeKitWebhookSignature(
				JSON.stringify({ ...payload, status: "OFFLINE" }),
				bytesToBase64(new Uint8Array(signature)),
				spkiToPem(publicKey),
			),
		).toBe(false);
	});

	it("keeps the legacy RealtimeKit live webhook side-effect free", async () => {
		const response = await realtimeKitStreamStartedWebhook({
			request: new Request(
				"https://rawkode.academy/api/webhooks/realtimekit/stream-started",
				{
					method: "POST",
					body: JSON.stringify({
						event: "livestreaming.statusUpdate",
						streamId: "stream-123",
						status: "LIVE",
					}),
				},
			),
		} as Parameters<typeof realtimeKitStreamStartedWebhook>[0]);
		const body = (await response.json()) as {
			ignored?: boolean;
			queued?: boolean;
			reason?: string;
		};

		expect(response.status).toBe(202);
		expect(body).toMatchObject({
			ignored: true,
			reason: "Studio Cloudflare Stream confirmation owns live notifications.",
		});
		expect(body.queued).toBeUndefined();
	});
});
