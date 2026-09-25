import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createAuth } from "../../lib/auth";

const handler: APIRoute = async (context) => {
	const auth = await createAuth(env);
	const url = new URL(context.request.url);
	const pathname = url.pathname;

	const usernameClientIds = ["rawkode-academy-website", "klustered-dev"];
	const readUsername = async (userId: string) =>
		env.DB.prepare("SELECT username FROM user WHERE id = ?")
			.bind(userId)
			.first<{ username: string | null }>();

	if (
		context.request.method === "GET" &&
		pathname === "/auth/username/continue"
	) {
		const next = url.searchParams.get("next");
		if (!next) return new Response("Missing authorization request", { status: 400 });

		let authorizeUrl: URL;
		try {
			authorizeUrl = new URL(next, url.origin);
		} catch {
			return new Response("Invalid authorization request", { status: 400 });
		}
		if (
			authorizeUrl.origin !== url.origin ||
			authorizeUrl.pathname !== "/auth/oauth2/authorize" ||
			!usernameClientIds.includes(authorizeUrl.searchParams.get("client_id") ?? "")
		) {
			return new Response("Invalid authorization request", { status: 400 });
		}

		const session = await auth.api.getSession({
			headers: context.request.headers,
		});
		if (!session) {
			return new Response("GitHub reauthorization did not complete", { status: 401 });
		}
		const identityUser = await readUsername(session.user.id);
		if (!identityUser?.username) {
			return new Response("Could not verify your GitHub username. Please try again.", {
				status: 503,
			});
		}
		return Response.redirect(authorizeUrl.toString(), 302);
	}

	if (
		context.request.method === "GET" &&
		pathname === "/auth/oauth2/authorize" &&
		usernameClientIds.includes(url.searchParams.get("client_id") ?? "")
	) {
		const session = await auth.api.getSession({
			headers: context.request.headers,
		});
		if (session) {
			const identityUser = await readUsername(session.user.id);
			if (!identityUser?.username) {
				const continuationUrl = new URL("/auth/username/continue", url.origin);
				continuationUrl.searchParams.set("next", url.toString());
				const signInUrl = new URL("/auth/sign-in/social", url.origin);
				signInUrl.searchParams.set("callbackURL", continuationUrl.toString());
				return Response.redirect(signInUrl, 302);
			}
		}
	}

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
