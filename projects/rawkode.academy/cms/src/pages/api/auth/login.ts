import type { APIRoute } from "astro";
import { authorizationRequest } from "@/lib/auth";

export const prerender = false;

const PKCE_COOKIE = "cms-pkce";

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
	const { url: authorize, verifier, state } = await authorizationRequest(
		url.origin,
		url.searchParams.get("returnTo") ?? "/",
	);
	cookies.set(PKCE_COOKIE, `${state}|${verifier}`, {
		path: "/api/auth/",
		httpOnly: true,
		secure: url.protocol === "https:",
		sameSite: "lax",
		maxAge: 600,
	});
	return redirect(authorize);
};
