/**
 * DEV-only helper that installs a session cookie tied to the screenshot
 * admin user seeded by scripts/seed-screenshot-session.ts. 404s in production
 * builds (import.meta.env.DEV is false outside `astro dev`).
 */
import type { APIRoute } from "astro";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth/server";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	if (!import.meta.env.DEV) {
		return new Response("Not found", { status: 404 });
	}

	cookies.set(SESSION_COOKIE_NAME, "screenshot-session-id", {
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_DURATION_SECONDS,
	});

	const returnTo = url.searchParams.get("returnTo") ?? "/";
	return redirect(returnTo, 303);
};
