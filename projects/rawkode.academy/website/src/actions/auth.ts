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
			const success = await serverSignOut(cookies, context.locals.runtime?.env);

			if (success) {
				// Clear local session cookies
				context.cookies.delete("better-auth.session_token", {
					path: "/",
					domain: ".rawkode.academy",
				});
			}

			return { success };
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
