import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { SessionStore } from "../lib/session.ts";

/** An admin sees exactly what an organisation sees, read-only. Empty target exits. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
	const { session, sessionId } = locals;
	if (!session || !sessionId || !session.principal.admin) return Response.json({ error: "Forbidden" }, { status: 403 });
	const target = String((await request.formData()).get("target") ?? "");
	const { viewAs: _gone, ...rest } = session;
	const next = target ? { ...rest, viewAs: { orgId: target, kind: "partner" as const } } : rest;
	await new SessionStore(env.SESSION).put(sessionId, next);
	if (target) console.log(JSON.stringify({ event: "view_as_start", admin: session.principal.login, orgId: target }));
	return redirect("/", 303);
};
