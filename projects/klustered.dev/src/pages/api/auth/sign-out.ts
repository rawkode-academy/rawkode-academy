import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { deleteLocalSession, SESSION_COOKIE_NAME } from "@/lib/auth/server";

export const prerender = false;

async function clearSession(sessionId: string | undefined) {
	if (!sessionId) return;
	await deleteLocalSession(sessionId, env.SESSION);
}

export const POST: APIRoute = async ({ cookies, redirect }) => {
	await clearSession(cookies.get(SESSION_COOKIE_NAME)?.value);
	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
	return redirect("/", 302);
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
	await clearSession(cookies.get(SESSION_COOKIE_NAME)?.value);
	cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
	return redirect("/", 302);
};
