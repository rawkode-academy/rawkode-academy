import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SessionStore, sessionCookie } from "../lib/session.ts";

export const POST: APIRoute = async ({ request, locals }) => {
	if (locals.sessionId) await new SessionStore(env.SESSION).delete(locals.sessionId);
	return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": sessionCookie(request, "", 0) } });
};
