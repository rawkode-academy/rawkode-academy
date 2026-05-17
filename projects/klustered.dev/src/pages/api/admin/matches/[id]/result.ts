import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

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
	const recordedByUserId = locals.user?.id ?? null;

	const db = getDb(env.DB);

	const match = await db
		.select()
		.from(schema.matches)
		.where(eq(schema.matches.id, matchId))
		.get();
	if (!match) return new Response("match not found", { status: 404 });

	const now = new Date();

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
				scoreA,
				scoreB,
				notes,
				recordedAt: now,
				recordedByUserId,
			})
			.where(eq(schema.matchResults.matchId, matchId));
	} else {
		await db.insert(schema.matchResults).values({
			id: `mres-${crypto.randomUUID()}`,
			matchId,
			winnerTeamId,
			timeToResolveSeconds,
			scoreA,
			scoreB,
			notes,
			recordedAt: now,
			recordedByUserId,
		});
	}

	await db
		.update(schema.matches)
		.set({
			status: "completed",
			winnerTeamId,
			endedAt: now,
			startedAt: match.startedAt ?? now,
		})
		.where(eq(schema.matches.id, matchId));

	await advanceBracket(db, match.bracketId);

	return redirect(`/admin/matches/${matchId}`, 303);
};

async function advanceBracket(
	db: ReturnType<typeof getDb>,
	bracketId: string,
): Promise<void> {
	const all = await db
		.select()
		.from(schema.matches)
		.where(eq(schema.matches.bracketId, bracketId))
		.all();

	const currentRound = Math.max(...all.map((m) => m.roundNumber));
	const thisRound = all.filter((m) => m.roundNumber === currentRound);
	const nextRoundExists = all.some((m) => m.roundNumber === currentRound + 1);

	const allCompleted =
		thisRound.length > 0 && thisRound.every((m) => m.status === "completed");
	if (!allCompleted || nextRoundExists) return;

	const winners = thisRound
		.sort((a, b) => a.positionInRound - b.positionInRound)
		.map((m) => m.winnerTeamId)
		.filter((id): id is string => id !== null);

	if (winners.length < 2) {
		// Tournament finished
		await db
			.update(schema.brackets)
			.set({ status: "finished" })
			.where(eq(schema.brackets.id, bracketId));
		return;
	}

	const nextMatches: typeof schema.matches.$inferInsert[] = [];
	let position = 1;
	for (let i = 0; i < winners.length; i += 2) {
		nextMatches.push({
			id: `mch-${crypto.randomUUID()}`,
			bracketId,
			roundNumber: currentRound + 1,
			positionInRound: position++,
			status: "scheduled",
			teamAId: winners[i],
			teamBId: winners[i + 1] ?? null,
		});
	}

	await db.insert(schema.matches).values(nextMatches);
}
