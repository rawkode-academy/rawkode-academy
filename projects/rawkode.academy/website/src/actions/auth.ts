import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getSignInUrl, signOut as serverSignOut } from "@/lib/auth/server";

export const auth = {
	signInWithGithub: defineAction({
		input: z.object({
			callbackURL: z.string().optional(),
		}),
		handler: async (input) => {
			const callbackURL = new URL(
				input.callbackURL || "/",
				"https://rawkode.academy",
			).toString();

			const url = getSignInUrl(callbackURL);
			return { url };
		},
	}),

	signOut: defineAction({
		handler: async (_, context) => {
			const cookies = context.request.headers.get("Cookie") || "";

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

			return { success: true };
		},
	}),

	getLoginUrl: defineAction({
		input: z.object({
			callbackURL: z.string().optional(),
		}),
		handler: async (input) => {
			const callbackURL = input.callbackURL
				? new URL(input.callbackURL, "https://rawkode.academy").toString()
				: undefined;

			return { url: getSignInUrl(callbackURL) };
		},
	}),
};
