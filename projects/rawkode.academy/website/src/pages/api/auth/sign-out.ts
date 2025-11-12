import { ZITADEL_CLIENT_ID, ZITADEL_URL } from "astro:env/server";
import { captureServerEvent } from "@/server/posthog";
import { decodeJWT } from "@oslojs/jwt";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
	// Try to capture sign-out with distinct id from idToken (if present)
	try {
		const idToken = cookies.get("idToken")?.value;
		if (idToken) {
			const claims = decodeJWT(idToken) as any;
			const distinctId: string | undefined = claims?.sub;
			if (distinctId) {
				// Fire-and-forget; do not await in redirect path
				void captureServerEvent({ event: "auth_sign_out", distinctId });
			}
		}
	} catch (err) {
		console.error("Failed to send PostHog sign-out event", err);
	}

	cookies.delete("accessToken", {
		secure: import.meta.env.PROD === true,
		httpOnly: true,
		path: "/",
		sameSite: "strict",
	});
	// Also clear id/refresh tokens if present
	cookies.delete("idToken", {
		secure: import.meta.env.PROD === true,
		httpOnly: true,
		path: "/",
		sameSite: "strict",
	});
	cookies.delete("refreshToken", {
		secure: import.meta.env.PROD === true,
		httpOnly: true,
		path: "/",
		sameSite: "strict",
	});

	return redirect(
		`${ZITADEL_URL}/oidc/v1/end_session?post_logout_redirect_uri=${import.meta.env.SITE}&client_id=${ZITADEL_CLIENT_ID}`,
	);
};
