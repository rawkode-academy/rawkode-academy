import { WorkOS } from "@workos-inc/node";
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ locals, redirect }) => {
	const env = locals.runtime.env;

	const workos = new WorkOS(env.WORKOS_API_KEY);
	const clientId = env.WORKOS_CLIENT_ID || "";

	const authorizationUrl = workos.userManagement.getAuthorizationUrl({
		provider: 'authkit',
		redirectUri: locals.runtime.env.REDIRECT_URL,
		clientId,
	});


	return redirect(authorizationUrl);
}
