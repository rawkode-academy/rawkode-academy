/**
 * Single-elimination round-1 generator.
 *
 * Pairs all teams in the bracket's season in seed order (random for now).
 * Odd team out gets a bye (matched against null teamB) and is auto-advanced
 * by leaving teamA only. Subsequent rounds materialise as winners are
 * recorded via /api/admin/matches/[id]/result.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const prerender = false;

function shuffle<T>(arr: T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const bracketId = params.id;
	if (!bracketId) return new Response("missing id", { status: 400 });

	const db = getDb(env.DB);

	const bracket = await db
		.select()
		.from(schema.brackets)
		.where(eq(schema.brackets.id, bracketId))
		.get();
	if (!bracket) return new Response("bracket not found", { status: 404 });

	const existing = await db
		.select({ id: schema.matches.id })
		.from(schema.matches)
		.where(eq(schema.matches.bracketId, bracketId))
		.all();
	if (existing.length > 0) {
		return new Response("bracket already has matches", { status: 409 });
	}

	const teams = await db
		.select({ id: schema.teams.id })
		.from(schema.teams)
		.where(eq(schema.teams.seasonId, bracket.seasonId))
		.all();
	if (teams.length < 2) {
		return new Response("need at least 2 teams in the season", { status: 400 });
	}

	const seeded = shuffle(teams.map((t) => t.id));
	const matchRows: typeof schema.matches.$inferInsert[] = [];
	let position = 1;
	for (let i = 0; i < seeded.length; i += 2) {
		matchRows.push({
			id: `mch-${crypto.randomUUID()}`,
			bracketId,
			roundNumber: 1,
			positionInRound: position++,
			status: "scheduled",
			teamAId: seeded[i],
			teamBId: seeded[i + 1] ?? null,
		});
	}

	await db.insert(schema.matches).values(matchRows);
	await db
		.update(schema.brackets)
		.set({ status: "active" })
		.where(eq(schema.brackets.id, bracketId));

	return redirect(`/admin/brackets/${bracketId}`, 303);
};
