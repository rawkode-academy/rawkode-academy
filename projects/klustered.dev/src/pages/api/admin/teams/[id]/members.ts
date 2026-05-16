import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const teamId = params.id;
	if (!teamId) return new Response("missing team id", { status: 400 });

	const form = await request.formData();
	const competitorId = String(form.get("competitorId") ?? "").trim();
	const role = String(form.get("role") ?? "").trim() || null;

	if (!competitorId) {
		return new Response("competitorId required", { status: 400 });
	}

	const db = getDb(env.DB);
	await db.insert(schema.teamMembers).values({
		teamId,
		competitorId,
		role,
	});

	return redirect(`/admin/teams/${teamId}`, 303);
};
