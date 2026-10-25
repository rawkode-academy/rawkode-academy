// POST /api/cache/invalidate — called by content writers after D1 writes.
//
//   curl -X POST https://rawkode.academy/api/cache/invalidate \
//     -H "Authorization: Bearer $CACHE_INVALIDATION_TOKEN" \
//     -H "content-type: application/json" \
//     -d '{"tags":["videos:<id>","people:<id>"]}'      # or '{"all":true}'
//
// Bumps the content generation in KV (so every cached gateway payload is
// refetched) and purges CDN responses carrying the tags, plus each entity
// tag's collection tag. `all` purges every collection tag. The purge is
// repeated ~50s later (the response waits for it) to catch pages rendered
// by edges that still read the old generation; pass "settle": false to skip.
import type { APIRoute } from "astro";
import { getContentEnv } from "@/lib/live-content/env";
import {
	handleInvalidationRequest,
	type PurgeTags,
	workersCachePurge,
} from "@/lib/live-content/invalidate";

export const prerender = false;

async function workersPurge(): Promise<PurgeTags> {
	let cache: Parameters<typeof workersCachePurge>[0];
	try {
		({ cache } = (await import("cloudflare:workers")) as unknown as {
			cache: Parameters<typeof workersCachePurge>[0];
		});
	} catch {}
	return workersCachePurge(cache);
}

export const POST: APIRoute = async (context) => {
	const env = await getContentEnv();
	return handleInvalidationRequest(context.request, {
		token: env.CACHE_INVALIDATION_TOKEN,
		kv: env.CONTENT_CACHE,
		// The Astro provider's invalidate() ignores cache.purge()'s result;
		// call it directly so a failed purge answers 502 and writers retry.
		purge: context.cache.enabled ? await workersPurge() : undefined,
	});
};

export const ALL: APIRoute = () =>
	new Response(JSON.stringify({ error: "Use POST" }), {
		status: 405,
		headers: { "content-type": "application/json", allow: "POST" },
	});
