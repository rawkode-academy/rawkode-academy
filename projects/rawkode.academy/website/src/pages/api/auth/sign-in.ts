import type { APIRoute } from "astro";
import { buildAuthorizationUrl, PKCE_COOKIE_NAME } from "@/lib/auth/server";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

export const GET: APIRoute = async (context) => {
	let returnTo = context.url.searchParams.get("returnTo") || "/";

	// Fallback to Referer header if returnTo is a server island path
	// (Server islands have their own internal URL context)
	if (returnTo.startsWith("/_server-islands/") || returnTo === "/") {
		const referer = context.request.headers.get("referer");
		if (referer) {
			try {
				const refererUrl = new URL(referer);
				// Only use referer if it's same-origin
				if (refererUrl.origin === context.url.origin) {
					returnTo = refererUrl.pathname;
				}
			} catch {
				// Invalid referer URL, keep default
			}
		}
	}

	const origin = context.url.origin;

	const runtime = context.locals.runtime;
	const analytics = runtime?.env?.ANALYTICS as Fetcher | undefined;

	await captureServerEvent(
		{
			event: "sign_in_initiated",
			properties: {
				auth_method: "github",
				from_page: returnTo,
			},
			distinctId: getDistinctId(context),
		},
		analytics,
	);

	const { url, codeVerifier } = await buildAuthorizationUrl(origin, returnTo);

	// Store code verifier in a secure, short-lived cookie for the callback
	context.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
		path: "/",
		httpOnly: true,
		secure: context.url.protocol === "https:",
		sameSite: "lax",
		maxAge: 60 * 10, // 10 minutes - enough time for auth flow
	});

	return context.redirect(url, 302);
};
