import type { APIRoute } from "astro";
import { env, waitUntil } from "cloudflare:workers";
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

	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}
	// Content-Length is absent on chunked bodies, so check what was read too.
	const text = await request.text().catch(() => "");
	if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}

	const body = (() => {
		try {
			return JSON.parse(text) as { events?: unknown } | null;
		} catch {
			return null;
		}
	})();
	if (!body || !Array.isArray(body.events) || body.events.length === 0) {
		return new Response(null, { status: 400 });
	}

	const analytics = env.ANALYTICS as unknown as CollectorRpc | undefined;
	if (!analytics) return new Response(null, { status: 204 });

	const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;

	const forward = analytics
		.ingestWebEvents(body.events.slice(0, MAX_EVENTS), {
			user_id: locals.user?.id,
			user_agent: request.headers.get("user-agent") ?? "",
			country: cf?.country,
			continent: cf?.continent,
		})
		.catch((error: unknown) => {
			logger.error("Analytics ingest failed", error);
		});
	// The reader's request shouldn't wait on the lake.
	waitUntil(forward);

	return new Response(null, { status: 204 });
};
