import { WorkOS } from "@workos-inc/node";
import type { APIRoute } from 'astro';
import { getSecret } from "astro:env/server";

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
	const { REDIRECT_URL } = await import("astro:env/server");

	const workos = new WorkOS(getSecret("WORKOS_API_KEY"));
	const clientId = getSecret("WORKOS_CLIENT_ID") || "";

	const authorizationUrl = workos.userManagement.getAuthorizationUrl({
		provider: 'authkit',
		redirectUri: REDIRECT_URL,
		clientId,
	});


	return redirect(authorizationUrl);
}
