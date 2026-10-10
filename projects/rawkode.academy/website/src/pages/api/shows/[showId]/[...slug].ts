import { env } from "cloudflare:workers";
import { getEntry } from "@/lib/payload-content";
import type { APIRoute } from "astro";
import { getShowExtension } from "@/lib/shows/registry";
import type { ShowEnv } from "@/lib/shows/types";

export const prerender = false;

export const ALL: APIRoute = async ({ locals, params, request, url }) => {
	const { showId, slug } = params;
	if (!showId) return new Response(null, { status: 404 });

	const show = await getEntry("shows", { slug: showId });
	if (!show) return new Response(null, { status: 404 });

	const ext = getShowExtension(show.slug);
	const endpoint = ext?.endpoints?.find((e) => e.slug === (slug ?? ""));
	if (!ext || !endpoint) return new Response(null, { status: 404 });
	return endpoint.handler({
		showId: show.slug,
		slug: endpoint.slug,
		params,
		request,
		url,
		env: env as unknown as ShowEnv,
		locals,
	});
};
