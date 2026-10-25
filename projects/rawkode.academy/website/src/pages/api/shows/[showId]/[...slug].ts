import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getEntry, setContentCache } from "@/lib/live-content";
import { getShowExtension } from "@/lib/shows/registry";
import type { ShowEnv } from "@/lib/shows/types";

export const prerender = false;

const directive = (cacheControl: string, name: string) => {
	const match = cacheControl.match(new RegExp(`(?:^|[,\\s])${name}=(\\d+)`));
	return match ? Number(match[1]) : undefined;
};

export const ALL: APIRoute = async (context) => {
	const { locals, params, request, url } = context;
	const { showId, slug } = params;
	if (!showId) return new Response(null, { status: 404 });

	const ext = getShowExtension(showId);
	const endpoint = ext?.endpoints?.find((e) => e.slug === (slug ?? ""));
	if (!ext || !endpoint) return new Response(null, { status: 404 });
	const show = await getEntry("shows", showId);
	if (!show?.data.publish) {
		return new Response(null, { status: 404 });
	}

	const response = await endpoint.handler({
		showId,
		slug: endpoint.slug,
		params,
		request,
		url,
		env: env as unknown as ShowEnv,
		locals,
	});

	// The CDN only stores what declares cache intent through Astro's cache
	// provider. Keep a plugin's explicit public shared TTL (e.g. the live
	// match poll's s-maxage=15) as that intent; everything else stays
	// uncached.
	const cacheControl = response.headers.get("Cache-Control") ?? "";
	const sharedMaxAge = directive(cacheControl, "s-maxage");
	if (
		(request.method === "GET" || request.method === "HEAD") &&
		response.status === 200 &&
		/(?:^|[,\s])public(?:$|[,\s])/.test(cacheControl) &&
		sharedMaxAge !== undefined &&
		!response.headers.has("Set-Cookie")
	) {
		await setContentCache(context, {
			entries: [show],
			maxAge: sharedMaxAge,
			swr: directive(cacheControl, "stale-while-revalidate") ?? 0,
		});
	}
	return response;
};
