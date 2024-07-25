import { WorkOS } from "@workos-inc/node";
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ redirect }) => {
	const { getSecret } = await import("astro:env/server");

	const workos = new WorkOS(getSecret("WORKOS_API_KEY"));
	const clientId = getSecret("WORKOS_CLIENT_ID") || "";

	const authorizationUrl = workos.userManagement.getAuthorizationUrl({
		provider: 'authkit',
		redirectUri: getSecret("REDIRECT_URL") || "",
		clientId,
	});


	return redirect(authorizationUrl);
}
