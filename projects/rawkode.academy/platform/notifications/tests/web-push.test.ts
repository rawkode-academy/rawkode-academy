import { describe, expect, it, vi } from "vitest";
import {
	base64UrlToBytes,
	bytesToBase64Url,
	sendWebPush,
	WebPushSubscriptionExpiredError,
} from "../src/web-push.js";

async function createVapidKeys() {
	const keyPair = (await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const jwk = (await crypto.subtle.exportKey(
		"jwk",
		keyPair.privateKey,
	)) as JsonWebKey;
	if (!jwk.x || !jwk.y || !jwk.d) {
		throw new Error("Generated key is missing P-256 coordinates");
	}

	return {
		publicKey: bytesToBase64Url(
			new Uint8Array([
				4,
				...base64UrlToBytes(jwk.x),
				...base64UrlToBytes(jwk.y),
			]),
		),
		privateKey: jwk.d,
	};
}

async function createSubscriptionKeys() {
	const keyPair = (await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	)) as CryptoKeyPair;
	const publicKey = new Uint8Array(
		(await crypto.subtle.exportKey("raw", keyPair.publicKey)) as ArrayBuffer,
	);
	const auth = crypto.getRandomValues(new Uint8Array(16));
	return {
		p256dh: bytesToBase64Url(publicKey),
		auth: bytesToBase64Url(auth),
	};
}

describe("web push", () => {
	it("sends an encrypted Web Push request with VAPID authorization", async () => {
		const vapid = await createVapidKeys();
		const keys = await createSubscriptionKeys();
		const fetcher = vi.fn(async () => new Response(null, { status: 201 }));

		const result = await sendWebPush(
			{
				endpoint: "https://push.example.test/send/abc",
				keys,
			},
			{
				title: "Stream is live",
				body: "The stream has started.",
				tag: "stream:test",
				url: "https://rawkode.academy/watch/test",
				kind: "stream-started",
				data: {
					videoSlug: "test",
				},
			},
			{
				...vapid,
				subject: "mailto:david@rawkode.email",
				now: () => Date.parse("2026-07-09T16:45:00.000Z"),
			},
			fetcher as unknown as typeof fetch,
		);

		expect(result.status).toBe(201);
		expect(fetcher).toHaveBeenCalledTimes(1);
		const [endpoint, init] = fetcher.mock.calls[0] as unknown as [
			string,
			RequestInit & { headers: Record<string, string>; body: Uint8Array },
		];
		expect(endpoint).toBe("https://push.example.test/send/abc");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toContain("vapid t=");
		expect(init.headers.Authorization).toContain(`k=${vapid.publicKey}`);
		const token = init.headers.Authorization.match(/^vapid t=([^,]+), k=/)?.[1];
		expect(token).toBeDefined();
		const signature = token?.split(".")[2];
		expect(signature).toBeDefined();
		expect(base64UrlToBytes(signature ?? "")).toHaveLength(64);
		expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
		expect(init.body).toBeInstanceOf(Uint8Array);
	});

	it("marks expired push subscriptions", async () => {
		const vapid = await createVapidKeys();
		const keys = await createSubscriptionKeys();

		await expect(
			sendWebPush(
				{
					endpoint: "https://push.example.test/send/expired",
					keys,
				},
				{
					title: "Stream is live",
					body: "The stream has started.",
					tag: "stream:test",
					url: "https://rawkode.academy/watch/test",
					kind: "stream-started",
					data: {
						videoSlug: "test",
					},
				},
				{
					...vapid,
					subject: "mailto:david@rawkode.email",
				},
				vi.fn(async () => new Response(null, { status: 410 })) as unknown as typeof fetch,
			),
		).rejects.toBeInstanceOf(WebPushSubscriptionExpiredError);
	});
});
