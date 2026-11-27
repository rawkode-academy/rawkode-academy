import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { GatewayError, gql } from "../../lib/gateway.ts";
import { ADD_COMMENT, SIGN_OFF, TRIAGE } from "../../lib/queries.ts";
import { scopeFor } from "../../lib/scope.ts";

/**
 * The review page's actions. Each is one mutation on the federated API, run as
 * the signed-in member; the subgraph decides whether they may.
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const session = locals.session!;
	if (scopeFor(session).readOnly) return Response.json({ error: "Read-only while viewing as" }, { status: 403 });
	const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const call = (query: string, variables: Record<string, unknown>) => gql(env, session.accessToken, query, variables);
	try {
		switch (input?.action) {
			case "comment":
				await call(ADD_COMMENT, {
					reviewId: String(input.reviewId),
					body: String(input.body ?? ""),
					timestampMs: typeof input.timestampMs === "number" ? Math.round(input.timestampMs) : null,
				});
				break;
			case "triage":
				await call(TRIAGE, { id: String(input.id), triage: String(input.triage) });
				break;
			case "signoff":
				await call(SIGN_OFF, { id: String(input.reviewId) });
				break;
			default:
				return Response.json({ error: "Unknown action" }, { status: 400 });
		}
		return Response.json({ ok: true });
	} catch (error) {
		return Response.json({ error: error instanceof GatewayError ? error.message : "Something went wrong" }, { status: 400 });
	}
};
