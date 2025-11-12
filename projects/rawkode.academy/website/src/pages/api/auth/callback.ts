import { Zitadel } from "@/lib/zitadel";
import {
	identifyServerUser,
	captureServerEvent,
	getAnonDistinctIdFromCookies,
} from "@/server/posthog";
import { decodeJWT } from "@oslojs/jwt";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({
	cookies,
	redirect,
	request,
}): Promise<Response> => {
	const url = new URL(request.url);
	const searchParams = url.searchParams;

	const code = searchParams.get("code");
	const state = searchParams.get("state");

	if (!code || !state) {
		return new Response(null, {
			status: 401,
			statusText: "Unable to authenticate user. PKCE flow not completed",
		});
	}

	const cookieState = cookies.get("state");
	const cookieCodeVerifier = cookies.get("codeVerifier");

	cookies.delete("state");
	cookies.delete("codeVerifier");

	if (!cookieState || !cookieCodeVerifier) {
		return new Response(null, {
			status: 401,
			statusText: "Unable to authenticate user. PKCE flow not started",
		});
	}

	if (cookieState.value !== state) {
		return new Response(null, {
			status: 401,
			statusText: "Unable to authenticate user. State mismatch",
		});
	}

	console.log(cookieState.value);
	console.log(cookieCodeVerifier.value);

	const zitadel = new Zitadel();

	let tokens = undefined;
	try {
		tokens = await zitadel.validateAuthorizationCode(
			code,
			cookieCodeVerifier.value,
		);
	} catch (e) {
		console.log(e);

		return new Response(null, {
			status: 500,
			statusText: "Unable to create authentication URL",
		});
	}

	cookies.set("accessToken", tokens.accessToken(), {
		secure: import.meta.env.MODE === "production",
		httpOnly: true,
		path: "/",
		maxAge: tokens.accessTokenExpiresInSeconds(),
		sameSite: "strict",
	});

	cookies.set("idToken", tokens.idToken(), {
		secure: import.meta.env.MODE === "production",
		httpOnly: true,
		path: "/",
		maxAge: tokens.accessTokenExpiresInSeconds(),
		sameSite: "strict",
	});

	if (tokens.hasRefreshToken()) {
		cookies.set("refreshToken", tokens.refreshToken(), {
			secure: import.meta.env.MODE === "production",
			httpOnly: true,
			path: "/",
			sameSite: "strict",
		});
	}

	// PostHog identify and auth_sign_in capture
	try {
		const anonId = getAnonDistinctIdFromCookies(request);
		const idToken = tokens.idToken();
		const claims = decodeJWT(idToken) as any;
		const distinctId: string | undefined = claims?.sub;

		if (distinctId) {
			await identifyServerUser({
				distinctId,
				anonId: anonId,
				set: {
					email: claims?.email,
					name: claims?.name,
				},
			});

			await captureServerEvent({
				event: "auth_sign_in",
				distinctId,
				properties: {
					provider: "zitadel",
					method: "oauth",
				},
			});
		}
	} catch (err) {
		console.error("Failed to send PostHog identify/sign-in event", err);
	}

	return redirect("/");
};
