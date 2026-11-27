import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { exchangeCode, originOf, randomToken } from "../../../lib/auth.ts";
import { SessionStore, sessionCookie } from "../../../lib/session.ts";

export const GET: APIRoute = async ({ request, url, redirect }) => {
	const store = new SessionStore(env.SESSION);
	const state = url.searchParams.get("state");
	const code = url.searchParams.get("code");
	const verifier = state ? await store.takeLogin(state) : null;
	if (!code || !verifier) return redirect("/login?error=1", 303);
	const signIn = await exchangeCode(env, originOf(env, request), code, verifier);
	if (!signIn) return redirect("/login?error=1", 303);
	const id = randomToken();
	const expiresAt = Date.now() + signIn.expiresInSeconds * 1000;
	await store.put(id, { principal: signIn.principal, accessToken: signIn.accessToken, expiresAt });
	return new Response(null, {
		status: 303,
		headers: { Location: "/", "Set-Cookie": sessionCookie(request, id, signIn.expiresInSeconds) },
	});
};
