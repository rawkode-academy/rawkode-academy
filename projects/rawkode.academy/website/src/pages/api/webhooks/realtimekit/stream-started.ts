import type { APIRoute } from "astro";
import {
	isRealtimeKitLiveStartEvent,
	type RealtimeKitWebhookPayload,
} from "@/lib/realtimekit-webhooks";

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

export const HEAD: APIRoute = async () => new Response(null, { status: 204 });

export const GET: APIRoute = async () =>
	json({ ok: true, webhook: "realtimekit.stream-started" });

export const POST: APIRoute = async ({ request }) => {
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

	return json(
		{
			ignored: true,
			event: payload.event ?? null,
			legacy: true,
			reason: isRealtimeKitLiveStartEvent(payload)
				? "Studio Cloudflare Stream confirmation owns live notifications."
				: "RealtimeKit event is not a Studio go-live signal.",
		},
		{ status: 202 },
	);
};
