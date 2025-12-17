import type { APIRoute } from "astro";
import { getSignInUrl } from "@/lib/auth/server";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

export const GET: APIRoute = async (context) => {
	const returnTo = context.url.searchParams.get("returnTo") || "/";
	const origin = context.url.origin;
	const callbackURL = new URL(returnTo, origin).toString();

	const runtime = context.locals.runtime;
	const analytics = runtime?.env?.ANALYTICS as Fetcher | undefined;

	await captureServerEvent(
		{
			event: "sign_in_initiated",
			properties: {
				auth_method: "github",
				callback_url: callbackURL,
				from_page: returnTo,
			},
			distinctId: getDistinctId(context),
		},
		analytics,
	);

	const signInUrl = getSignInUrl(callbackURL);
	return context.redirect(signInUrl, 302);
};
