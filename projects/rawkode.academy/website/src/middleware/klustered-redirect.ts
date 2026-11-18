import type { MiddlewareHandler } from "astro";

// klustered.live was a standalone site; its public page now lives at
// rawkode.academy/shows/klustered, a holding notice. When the website worker
// serves a request on a klustered.live host, 301 every path to that page.

const KLUSTERED_HOSTS = new Set(["klustered.live", "www.klustered.live"]);
const CANONICAL_ORIGIN = "https://rawkode.academy";
const SHOW_BASE = "/shows/klustered";

export const klusteredRedirectMiddleware: MiddlewareHandler = async (
	context,
	next,
) => {
	if (!KLUSTERED_HOSTS.has(context.url.hostname)) {
		return next();
	}

	const target = `${CANONICAL_ORIGIN}${SHOW_BASE}`;
	return new Response(null, {
		status: 301,
		headers: { Location: target, "Cache-Control": "public, max-age=3600" },
	});
};
