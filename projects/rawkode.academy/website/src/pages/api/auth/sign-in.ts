import type { APIRoute } from "astro";
import { botReason, clientAsn } from "@/lib/analytics/automation";
import { isPrefetch } from "@/lib/auth/prefetch";
import { buildAuthorizationUrl, PKCE_COOKIE_NAME } from "@/lib/auth/server";
import {
	analyticsFor,
	captureServerEvent,
	getDistinctId,
} from "@/server/analytics";

export const GET: APIRoute = async (context) => {
	if (isPrefetch(context.request)) {
		// Never let the browser reuse this empty response for the real click.
		return new Response(null, {
			status: 204,
			headers: {
				"Cache-Control": "no-store",
				Vary: "Sec-Purpose, Purpose, Sec-Fetch-Mode",
			},
		});
	}

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

	// Crawlers follow the sign-in link (robots.txt disallows /api/), and most
	// starts are theirs. Every start is recorded; the collector labels bots
	// from this verdict, the user agent and the ASN.
	await captureServerEvent(
		{
			event: "sign_in_initiated",
			properties: {
				auth_method: "github",
				from_page: returnTo,
				user_agent: context.request.headers.get("user-agent") ?? "",
				asn: clientAsn(context.request),
				bot_reason: botReason(context.request),
			},
			distinctId: getDistinctId(context),
		},
		analyticsFor(context),
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
