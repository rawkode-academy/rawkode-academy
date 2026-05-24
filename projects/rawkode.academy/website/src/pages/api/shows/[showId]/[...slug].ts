import type { APIRoute } from "astro";
import { getShowExtension } from "@/lib/shows/registry";
import type { ShowEnv } from "@/lib/shows/types";

export const prerender = false;

export const ALL: APIRoute = async ({ params, request, locals, url }) => {
	const { showId, slug } = params;
	if (!showId) return new Response(null, { status: 404 });

	const ext = getShowExtension(showId);
	const endpoint = ext?.endpoints?.find((e) => e.slug === (slug ?? ""));
	if (!ext || !endpoint) return new Response(null, { status: 404 });

	const env =
		(locals as { runtime?: { env?: ShowEnv } }).runtime?.env ?? {};

	return endpoint.handler({
		showId,
		slug: endpoint.slug,
		params,
		request,
		url,
		env,
	});
};
