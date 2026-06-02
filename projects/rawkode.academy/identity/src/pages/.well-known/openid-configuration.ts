import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createAuth } from "../../lib/auth";

const handler: APIRoute = async (context) => {
	const auth = await createAuth(env);
	const url = new URL(context.request.url);
	url.pathname = "/auth/.well-known/openid-configuration";
	return auth.handler(new Request(url.toString(), context.request));
};

export const GET = handler;

export const prerender = false;
