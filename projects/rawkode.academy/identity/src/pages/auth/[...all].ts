import type { APIRoute } from "astro";
import { createAuth } from "../../lib/auth";

const handler: APIRoute = async (context) => {
	const env = context.locals.runtime.env;
	const auth = await createAuth(env);
	const url = new URL(context.request.url);
	const pathname = url.pathname;

	if (context.request.method === "GET" && pathname === "/auth/sign-in/social") {
		const provider = "github";

		const callbackURL = url.searchParams.get("callbackURL") ?? undefined;

		const response = await auth.api.signInSocial({
			body: {
				provider,
				...(callbackURL ? { callbackURL } : {}),
			},
			headers: context.request.headers,
			asResponse: true,
		});

		// Transform Better Auth's JSON redirect into a proper HTTP 302 redirect
		if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
			const clone = response.clone();
			const data = (await clone.json()) as { url?: string; redirect?: boolean };

			if (data.redirect && data.url) {
				const headers = new Headers(response.headers);
				headers.set("Location", data.url);
				headers.delete("Content-Type");
				headers.delete("Content-Length");

				return new Response(null, {
					status: 302,
					headers,
				});
			}
		}

		return response;
	}

	return auth.handler(context.request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;

export const prerender = false;
