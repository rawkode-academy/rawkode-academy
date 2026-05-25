import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getBracketsDb, schema } from "@/db/client";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
	const s = String(v ?? "").trim();
	if (!s) return null;
	const n = Number.parseInt(s, 10);
	return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const matchId = params.id;
	if (!matchId) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const winnerTeamId = String(form.get("winnerTeamId") ?? "").trim();
	if (!winnerTeamId) {
		return new Response("winnerTeamId required", { status: 400 });
	}
	const timeToResolveSeconds = parseIntOrNull(form.get("timeToResolveSeconds"));
	const scoreA = parseIntOrNull(form.get("scoreA"));
	const scoreB = parseIntOrNull(form.get("scoreB"));
	const notes = String(form.get("notes") ?? "").trim() || null;

	// The form selects a team; the write-model keys results by bracket entry, so
	// map the chosen team to whichever entry occupies it in this match.
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
		scoreA,
		scoreB,
		timeToResolveSeconds,
		notes,
		recordedByUserId: locals.user?.id,
	});

	return redirect(`/admin/matches/${matchId}`, 303);
};
