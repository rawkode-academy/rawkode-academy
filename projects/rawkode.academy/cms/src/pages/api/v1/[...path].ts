import type { APIRoute } from "astro";
import { handleApi } from "@/lib/api";
import { apiEnv } from "@/lib/server";

export const prerender = false;

// The raw (still percent-encoded) path, so ids containing "/" (course
// modules: "<course>/<slug>") stay one segment until the router decodes them.
export const ALL: APIRoute = async ({ request, locals, url }) =>
	handleApi(await apiEnv(), {
		request,
		path: url.pathname.replace(/^\/api\/v1/, "") || "/",
		principal: locals.principal,
		origin: url.origin,
	});
