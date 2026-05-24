import type { MiddlewareHandler } from "astro";

// klustered.live was a standalone site; its public experience now lives at
// rawkode.academy/shows/klustered. When the website worker serves a request on
// a klustered.live host, 301 it to the canonical path.

const KLUSTERED_HOSTS = new Set(["klustered.live", "www.klustered.live"]);
const CANONICAL_ORIGIN = "https://rawkode.academy";
const SHOW_BASE = "/shows/klustered";

function mapPath(pathname: string): string {
	if (pathname === "/schedule.ics") return "/api/shows/klustered/schedule.ics";
	if (/^\/(brackets|schedule|leaderboard|apply)\/?$/.test(pathname)) {
		return `${SHOW_BASE}/${pathname.replace(/^\/|\/$/g, "")}`;
	}
	// Everything else (home, about, rules, sponsors, episodes/*) lands on the hub.
	return SHOW_BASE;
}

export const klusteredRedirectMiddleware: MiddlewareHandler = async (
	context,
	next,
) => {
	if (!KLUSTERED_HOSTS.has(context.url.hostname)) {
		return next();
	}

	const target = `${CANONICAL_ORIGIN}${mapPath(context.url.pathname)}${context.url.search}`;
	return new Response(null, {
		status: 301,
		headers: { Location: target, "Cache-Control": "public, max-age=3600" },
	});
};
