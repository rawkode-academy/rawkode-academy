import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getSignInUrl, signOut } from "@/lib/auth/server";

export const auth = {
	signInWithGithub: defineAction({
		input: z.object({
			callbackUrl: z.string().optional(),
		}),
		handler: async (input) => {
			const url = getSignInUrl(input.callbackUrl || "https://app.rawkode.academy");
			return { url };
		},
	}),

	signOut: defineAction({
		handler: async (_input, context) => {
			const cookies = context.request.headers.get("Cookie") || "";
			const env = context.locals.runtime?.env;

			await signOut(cookies, env);

			// Clear cookies on our end too
			const cookiesToClear = [
				"better-auth.session_token",
				"__Secure-better-auth.session_token",
			];

			for (const name of cookiesToClear) {
				context.cookies.delete(name, { path: "/" });
			}

			return { success: true };
		},
	}),
};
