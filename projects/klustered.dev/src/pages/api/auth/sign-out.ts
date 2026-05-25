import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/server";

export const prerender = false;

async function clearSession(sessionId: string | undefined) {
	if (!sessionId) return;
	const db = getDb(env.DB);
	await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
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
