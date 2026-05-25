import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getBracketsDb, schema } from "@/db/client";
import { bracketsWrite } from "@/lib/brackets-write";

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
	if (!winnerTeamId)
		return new Response("winnerTeamId required", { status: 400 });

	// Map the selected team to its bracket entry in this match (see result.ts).
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
	const winnerEntryId =
		match?.teamAId === winnerTeamId
			? match.entryAId
			: match?.teamBId === winnerTeamId
				? match.entryBId
				: null;
	if (!winnerEntryId) {
		return new Response("winner is not a participant in this match", {
			status: 400,
		});
	}

	await bracketsWrite(env).recordResult({
		matchId,
		winnerEntryId,
		notes,
		recordedByUserId: locals.user?.id,
	});

	return redirect(`/admin/matches/${matchId}/live`, 303);
};
