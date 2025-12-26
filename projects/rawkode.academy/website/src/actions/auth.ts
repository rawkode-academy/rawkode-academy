import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
	signOut as serverSignOut,
	SESSION_COOKIE_NAME,
} from "@/lib/auth/server";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

export const auth = {
	signOut: defineAction({
		handler: async (_, context) => {
			const cookies = context.request.headers.get("Cookie") || "";
			const userId = context.locals.user?.id;

			// Best-effort call to identity service to invalidate server-side session
			await serverSignOut(cookies, context.locals.runtime?.env);

			// Clear local OIDC session cookie
			const localSessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
			if (localSessionId) {
				const sessionKv = context.locals.runtime?.env?.SESSION as
					| KVNamespace
					| undefined;
				if (sessionKv) {
					await sessionKv.delete(`session:${localSessionId}`);
				}
			}
			context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });

			// Clear legacy Better Auth session cookies (both secure and non-secure variants)
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
			returnTo: z.string().optional(),
		}),
		handler: async (input) => {
			const returnTo = input.returnTo || "/";
			// Return the sign-in endpoint URL which handles the OIDC flow
			return { url: `/api/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}` };
		},
	}),
};
