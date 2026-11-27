import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authorizationUrl, challengeFor, originOf, randomToken } from "../../lib/auth.ts";
import { SessionStore } from "../../lib/session.ts";

export const GET: APIRoute = async ({ request, redirect }) => {
	const state = randomToken();
	const verifier = randomToken(48);
	await new SessionStore(env.SESSION).putLogin(state, verifier);
	return redirect(authorizationUrl(env, originOf(env, request), state, await challengeFor(verifier)), 303);
};
