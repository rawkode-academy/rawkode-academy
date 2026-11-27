import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };

/**
 * The organisations a user belongs to, for the API gateway to authorise
 * cookie-session callers (the website). Only reachable through a service
 * binding: those requests carry the host `internal`, a public request carries
 * the real host. Ids and roles only.
 */
export const GET: APIRoute = async ({ request, url }) => {
	if (new URL(request.url).hostname !== "internal") {
		return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
	}
	const userId = url.searchParams.get("user") ?? "";
	if (!/^[A-Za-z0-9_-]{8,64}$/.test(userId)) {
		return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers });
	}
	const { results } = await env.DB.prepare(
		"SELECT organization_id AS id, role FROM member WHERE user_id = ? ORDER BY organization_id",
	)
		.bind(userId)
		.all<{ id: string; role: string }>();
	return new Response(JSON.stringify({ orgs: results }), { headers });
};
