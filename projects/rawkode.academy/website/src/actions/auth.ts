import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getSignInUrl, signOut as serverSignOut } from "@/lib/auth/server";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

export const auth = {
	signInWithGithub: defineAction({
		input: z.object({
			callbackURL: z.string().optional(),
		}),
		handler: async (input, context) => {
			const origin = new URL(context.request.url).origin;
			const callbackURL = new URL(input.callbackURL || "/", origin).toString();

			const url = getSignInUrl(callbackURL);

			const runtime = context.locals.runtime;
			const analytics = runtime?.env?.ANALYTICS as Fetcher | undefined;
			await captureServerEvent(
				{
					event: "sign_in_initiated",
					properties: {
						auth_method: "github",
						callback_url: callbackURL,
						from_page: new URL(context.request.url).pathname,
					},
					distinctId: getDistinctId(context),
				},
				analytics,
			);

			return { url };
		},
	}),

	signOut: defineAction({
		handler: async (_, context) => {
			const cookies = context.request.headers.get("Cookie") || "";
			const userId = context.locals.user?.id;

			// Best-effort call to identity service to invalidate server-side session
			await serverSignOut(cookies, context.locals.runtime?.env);

			// Always clear local session cookies (both secure and non-secure variants)
			context.cookies.delete("__Secure-better-auth.session_token", {
				path: "/",
				domain: ".rawkode.academy",
				secure: true,
			});
			context.cookies.delete("better-auth.session_token", {
				path: "/",
				domain: ".rawkode.academy",
			});

			const runtime = context.locals.runtime;
			const analytics = runtime?.env?.ANALYTICS as Fetcher | undefined;
			await captureServerEvent(
				{
					event: "sign_out_completed",
					properties: {
						user_id: userId,
					},
					distinctId: userId ?? getDistinctId(context),
				},
				analytics,
			);

			return { success: true };
		},
	}),

	getLoginUrl: defineAction({
		input: z.object({
			callbackURL: z.string().optional(),
		}),
		handler: async (input, context) => {
			const origin = new URL(context.request.url).origin;
			const callbackURL = input.callbackURL
				? new URL(input.callbackURL, origin).toString()
				: undefined;

			return { url: getSignInUrl(callbackURL) };
		},
	}),
};
