import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { GatewayError, gql } from "../../lib/gateway.ts";
import { SET_ANNOUNCEMENT } from "../../lib/queries.ts";
import { scopeFor } from "../../lib/scope.ts";

/** A partner sets the note shown with their videos. The subgraph decides who may. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const session = locals.session!;
	if (scopeFor(session).readOnly) return Response.json({ error: "Read-only while viewing as" }, { status: 403 });
	const form = await request.formData();
	const field = (name: string) => String(form.get(name) ?? "").trim();
	try {
		await gql(env, session.accessToken, SET_ANNOUNCEMENT, {
			collaboratorId: field("collaboratorId"),
			text: field("text"),
			url: field("url") || null,
		});
		return redirect("/?saved=announcement", 303);
	} catch (error) {
		return Response.json({ error: error instanceof GatewayError ? error.message : "Something went wrong" }, { status: 400 });
	}
};
