import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { env } from "cloudflare:workers";
import {
	isRealtimeKitLiveStartEvent,
	realtimeKitNotificationData,
	realtimeKitVideoMatchesPayload,
	verifyRealtimeKitWebhookSignature,
	type RealtimeKitLivestream,
	type RealtimeKitWebhookPayload,
} from "@/lib/realtimekit-webhooks";
import { streamNotificationSubjectKey } from "@/lib/stream-notifications";
import type { SendSubjectInput } from "notifications/src/contracts.js";

export const prerender = false;
const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

function json(data: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});
}

interface RealtimeKitConfig {
	accountId: string;
	apiToken: string;
	appId: string;
}

interface CloudflareEnvelope<T> {
	success?: boolean;
	errors?: Array<{ message?: string }>;
	data?: T;
	result?: T;
}

class PayloadTooLargeError extends Error {}

async function readRequestText(request: Request): Promise<string> {
	const contentLength = Number(request.headers.get("content-length") ?? 0);
	if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
		throw new PayloadTooLargeError("Webhook payload is too large.");
	}

	if (!request.body) return "";

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_WEBHOOK_BODY_BYTES) {
			throw new PayloadTooLargeError("Webhook payload is too large.");
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder().decode(bytes);
}

async function getRealtimeKitWebhookPublicKey(): Promise<string> {
	const response = await fetch(
		"https://api.realtime.cloudflare.com/.well-known/webhooks.json",
	);
	const body = (await response.json().catch(() => ({}))) as CloudflareEnvelope<{
		publicKey?: string;
	}>;
	if (!response.ok || body.success === false || !body.data?.publicKey) {
		const message =
			body.errors
				?.map((error) => error.message)
				.filter(Boolean)
				.join("; ") ||
			`RealtimeKit public key endpoint returned ${response.status}`;
		throw new Error(message);
	}

	return body.data.publicKey;
}

function readEnvString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readSecretString(
	secret: SecretsStoreSecret | undefined,
): Promise<string | null> {
	const value = await secret?.get();
	return readEnvString(value);
}

async function getRealtimeKitConfig(): Promise<RealtimeKitConfig | null> {
	const accountId = readEnvString(env.CLOUDFLARE_ACCOUNT_ID);
	const apiToken = await readSecretString(env.REALTIMEKIT_API_TOKEN);
	const appId = await readSecretString(env.REALTIMEKIT_APP_ID);
	if (!accountId || !apiToken || !appId) return null;

	return { accountId, apiToken, appId };
}

async function fetchRealtimeKitLivestream(
	config: RealtimeKitConfig,
	streamId: string,
): Promise<RealtimeKitLivestream | null> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/realtime/kit/${config.appId}/livestreams/${streamId}`,
		{
			headers: {
				Authorization: `Bearer ${config.apiToken}`,
				"Content-Type": "application/json",
			},
		},
	);
	const body = (await response.json().catch(() => ({}))) as CloudflareEnvelope<{
		livestream?: RealtimeKitLivestream;
	}>;
	if (!response.ok || body.success === false) {
		const message =
			body.errors
				?.map((error) => error.message)
				.filter(Boolean)
				.join("; ") || `RealtimeKit API returned ${response.status}`;
		throw new Error(message);
	}

	return (body.data ?? body.result)?.livestream ?? null;
}

async function resolveLiveVideo(payload: RealtimeKitWebhookPayload) {
	const videos = (await getCollection("videos")).filter(
		(entry) => entry.data.type === "live",
	);

	const mappedVideo = videos.find((entry) =>
		realtimeKitVideoMatchesPayload(
			{
				slug: entry.data.slug,
				title: entry.data.title,
				realtimeKit: entry.data.realtimeKit,
			},
			payload,
		),
	);
	if (mappedVideo || !payload.streamId) {
		return { video: mappedVideo ?? null, livestream: null };
	}

	const config = await getRealtimeKitConfig();
	if (!config) {
		throw new Error("RealtimeKit API configuration is missing.");
	}

	const livestream = await fetchRealtimeKitLivestream(config, payload.streamId);
	const video =
		videos.find((entry) =>
			realtimeKitVideoMatchesPayload(
				{
					slug: entry.data.slug,
					title: entry.data.title,
					realtimeKit: entry.data.realtimeKit,
				},
				payload,
				livestream,
			),
		) ?? null;

	return { video, livestream };
}

export const HEAD: APIRoute = async () => new Response(null, { status: 204 });

export const GET: APIRoute = async () =>
	json({ ok: true, webhook: "realtimekit.stream-started" });

export const POST: APIRoute = async ({ request }) => {
	const webhookId = readEnvString(env.REALTIMEKIT_WEBHOOK_ID);
	if (!webhookId) {
		return json(
			{ error: "RealtimeKit webhook ID is not configured." },
			{ status: 503 },
		);
	}
	if (request.headers.get("dyte-webhook-id") !== webhookId) {
		return json({ error: "Unauthorized." }, { status: 401 });
	}

	let rawPayload: string;
	try {
		rawPayload = await readRequestText(request);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return json({ error: error.message }, { status: 413 });
		}
		throw error;
	}

	let payload: RealtimeKitWebhookPayload;
	try {
		payload = JSON.parse(rawPayload) as RealtimeKitWebhookPayload;
	} catch {
		return json({ error: "Webhook payload must be JSON." }, { status: 400 });
	}

	const publicKey = await getRealtimeKitWebhookPublicKey().catch((error) => {
		console.error(
			JSON.stringify({
				event: "realtimekit_public_key_lookup_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		return null;
	});
	if (!publicKey) {
		return json(
			{ error: "RealtimeKit signature verification is unavailable." },
			{ status: 503 },
		);
	}

	const verified = await verifyRealtimeKitWebhookSignature(
		rawPayload,
		request.headers.get("dyte-signature"),
		publicKey,
	).catch((error) => {
		console.warn(
			JSON.stringify({
				event: "realtimekit_signature_verification_failed",
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		return false;
	});
	if (!verified) {
		return json({ error: "Unauthorized." }, { status: 401 });
	}

	if (!isRealtimeKitLiveStartEvent(payload)) {
		return json(
			{ ignored: true, event: payload.event ?? null },
			{ status: 202 },
		);
	}

	const resolved = await resolveLiveVideo(payload).catch((error) => {
		console.error(
			JSON.stringify({
				event: "realtimekit_stream_resolution_failed",
				streamId: payload.streamId ?? null,
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		return null;
	});
	if (!resolved) {
		return json(
			{ error: "RealtimeKit stream resolution failed." },
			{ status: 503 },
		);
	}

	const { video, livestream } = resolved;
	if (!video) {
		console.warn(
			JSON.stringify({
				event: "realtimekit_stream_not_mapped",
				streamId: payload.streamId ?? null,
				livestreamName: livestream?.name ?? null,
			}),
		);
		return json(
			{
				error: "RealtimeKit stream is not mapped to site content.",
				streamId: payload.streamId ?? null,
			},
			{ status: 503 },
		);
	}

	const notificationUrl = new URL(`/watch/${video.data.slug}`, request.url);
	const subjectKey = streamNotificationSubjectKey(video.data.slug);
	const notification = {
		subjectKey,
		title: `${video.data.title} is live`,
		body: "The stream has started on Rawkode Academy.",
		url: notificationUrl.href,
		tag: `stream:${video.data.slug}`,
		data: {
			videoSlug: video.data.slug,
			videoId: video.data.id,
			...realtimeKitNotificationData(payload),
		},
	} satisfies SendSubjectInput;

	await env.STREAM_NOTIFICATIONS.send(notification);

	return json({
		success: true,
		queued: true,
		subjectKey,
		videoSlug: video.data.slug,
	});
};
