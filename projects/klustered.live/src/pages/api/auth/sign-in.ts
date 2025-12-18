import type { APIRoute } from "astro";
import { buildAuthorizationUrl } from "@/lib/auth";

export const GET: APIRoute = async (context) => {
	const returnTo = context.url.searchParams.get("returnTo") || "/";
	const authUrl = buildAuthorizationUrl(context.url.origin, returnTo);

	return context.redirect(authUrl, 302);
};
