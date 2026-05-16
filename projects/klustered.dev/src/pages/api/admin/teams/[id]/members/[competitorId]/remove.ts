import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const teamId = params.id;
	const competitorId = params.competitorId;
	if (!teamId || !competitorId) {
		return new Response("missing ids", { status: 400 });
	}

	const db = getDb(env.DB);
	await db
		.delete(schema.teamMembers)
		.where(
			and(
				eq(schema.teamMembers.teamId, teamId),
				eq(schema.teamMembers.competitorId, competitorId),
			),
		);

	return redirect(`/admin/teams/${teamId}`, 303);
};
