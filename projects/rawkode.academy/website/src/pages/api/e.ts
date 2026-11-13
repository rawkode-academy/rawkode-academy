import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createLogger } from "@/lib/logger";

export const prerender = false;

const logger = createLogger("analytics-ingest");

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS = 50;

// The collector's RPC method; it has no HTTP route, so callers can't forge
// the user and request context added here.
interface CollectorRpc {
	ingestWebEvents(
		events: unknown[],
		context: {
			user_id?: string | undefined;
			url_origin: string;
			user_agent: string;
			country?: string | undefined;
			continent?: string | undefined;
		},
	): Promise<number>;
}

// Browser events collected by src/lib/analytics/track.ts. The collector owns
// the row schema; this endpoint only checks the envelope and attaches request
// context the browser can't be trusted to supply.
export const POST: APIRoute = async ({ request, locals, url }) => {
	const origin = request.headers.get("origin");
	if (origin && origin !== url.origin) {
		return new Response(null, { status: 403 });
	}

	if (request.headers.get("dnt") === "1")
		return new Response(null, { status: 204 });

	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}
	// Bound the stream as well as Content-Length before buffering it.
	const reader = request.body?.getReader();
	if (!reader) return new Response(null, { status: 400 });
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.byteLength;
			if (bytes > MAX_BODY_BYTES) {
				await reader.cancel();
				return new Response(null, { status: 413 });
			}
			chunks.push(chunk.value);
		}
	} catch {
		return new Response(null, { status: 400 });
	}
	const buffer = new Uint8Array(bytes);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const text = new TextDecoder().decode(buffer);

	const body = (() => {
		try {
			return JSON.parse(text) as { events?: unknown } | null;
		} catch {
			return null;
		}
	})();
	if (
		!body ||
		!Array.isArray(body.events) ||
		body.events.length === 0 ||
		body.events.length > MAX_EVENTS
	) {
		return new Response(null, { status: 400 });
	}

	const analytics = env.ANALYTICS as unknown as CollectorRpc | undefined;
	if (!analytics) return new Response(null, { status: 503 });

	const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;

	try {
		await analytics.ingestWebEvents(body.events, {
			user_id: locals.user?.id,
			url_origin: url.origin,
			user_agent: request.headers.get("user-agent") ?? "",
			country: cf?.country,
			continent: cf?.continent,
		});
	} catch (error) {
		logger.error("Analytics ingest failed", error);
		return new Response(null, { status: 503 });
	}
	return new Response(null, { status: 204 });
};
