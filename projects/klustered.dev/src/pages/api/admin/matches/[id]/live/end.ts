import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const matchId = params.id;
	if (!matchId) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const winnerTeamId = String(form.get("winnerTeamId") ?? "").trim();
	const notes = String(form.get("notes") ?? "").trim() || null;
	if (!winnerTeamId) return new Response("winnerTeamId required", { status: 400 });

	const db = getDb(env.DB);

	const match = await db
		.select()
		.from(schema.matches)
		.where(eq(schema.matches.id, matchId))
		.get();
	if (!match) return new Response("match not found", { status: 404 });
	if (!match.startedAt) {
		return new Response("match clock never started", { status: 409 });
	}

	const now = new Date();
	const timeToResolveSeconds = Math.max(
		0,
		Math.floor((now.getTime() - match.startedAt.getTime()) / 1000),
	);

	await db
		.update(schema.matches)
		.set({
			status: "completed",
			winnerTeamId,
			endedAt: now,
		})
		.where(eq(schema.matches.id, matchId));

	const existing = await db
		.select({ id: schema.matchResults.id })
		.from(schema.matchResults)
		.where(eq(schema.matchResults.matchId, matchId))
		.get();

	if (existing) {
		await db
			.update(schema.matchResults)
			.set({
				winnerTeamId,
				timeToResolveSeconds,
				notes,
				recordedAt: now,
				recordedByUserId: locals.user?.id ?? null,
			})
			.where(eq(schema.matchResults.matchId, matchId));
	} else {
		await db.insert(schema.matchResults).values({
			id: `mres-${crypto.randomUUID()}`,
			matchId,
			winnerTeamId,
			timeToResolveSeconds,
			notes,
			recordedAt: now,
			recordedByUserId: locals.user?.id ?? null,
		});
	}

	return redirect(`/admin/matches/${matchId}/live`, 303);
};
