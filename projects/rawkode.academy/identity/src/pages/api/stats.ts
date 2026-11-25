import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

/**
 * GET /api/stats
 * Public aggregate: the number of accounts, nothing else. Used by the
 * website's members-only reach page. No identifiers, cached for an hour.
 */
export const GET: APIRoute = async () => {
	try {
		const row = await env.DB.prepare("SELECT count(*) AS accounts FROM user").first<{
			accounts: number;
		}>();
		return Response.json(
			{ accounts: Number(row?.accounts ?? 0) },
			{ headers: { "Cache-Control": "public, max-age=3600" } },
		);
	} catch {
		return Response.json(
			{ error: "Unavailable" },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		);
	}
};
