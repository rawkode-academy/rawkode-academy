import { WorkOS } from "@workos-inc/node";
import type { APIRoute } from 'astro';
import { REDIRECT_URL } from "astro:env/client";
import { getSecret } from "astro:env/server";

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
	const workos = new WorkOS(getSecret("WORKOS_API_KEY"));
	const clientId = getSecret("WORKOS_CLIENT_ID") || "";

	const authorizationUrl = workos.userManagement.getAuthorizationUrl({
		provider: 'authkit',
		redirectUri: REDIRECT_URL,
		clientId,
	});


	return redirect(authorizationUrl);
}
