import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getBracketsDb, schema } from "@/db/client";
import { bracketsWrite } from "@/lib/brackets-write";
import { matchResultCommand } from "@/lib/match-admin";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const matchId = params.id;
	if (!matchId) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const match = await getBracketsDb(env.BRACKETS)
		.select({
			entryAId: schema.matches.entryAId,
			entryBId: schema.matches.entryBId,
			teamAId: schema.matches.teamAId,
			teamBId: schema.matches.teamBId,
		})
		.from(schema.matches)
		.where(eq(schema.matches.id, matchId))
		.get();
	if (!match) return new Response("match not found", { status: 404 });

	const recorded = matchResultCommand(form, match);
	if (!recorded.ok) {
		return new Response(recorded.message, { status: recorded.status });
	}

	await bracketsWrite(env).recordResult({
		matchId,
		...recorded.result,
		recordedByUserId: locals.user?.id,
	});

	return redirect(`/admin/matches/${matchId}`, 303);
};
