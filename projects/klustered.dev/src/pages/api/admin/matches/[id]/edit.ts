import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getBracketsDb, schema } from "@/db/client";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

const VALID_STATUS = ["scheduled", "live", "completed", "cancelled"] as const;
type Status = (typeof VALID_STATUS)[number];

function isStatus(v: string): v is Status {
	return (VALID_STATUS as readonly string[]).includes(v);
}

function nullable(v: FormDataEntryValue | null): string | null {
	const s = String(v ?? "").trim();
	return s.length === 0 ? null : s;
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const teamAId = nullable(form.get("teamAId"));
	const teamBId = nullable(form.get("teamBId"));
	const judgeUserId = nullable(form.get("judgeUserId"));
	const scheduledAtRaw = nullable(form.get("scheduledAt"));
	const status = String(form.get("status") ?? "").trim();

	if (!isStatus(status)) {
		return new Response("invalid status", { status: 400 });
	}

	// The form assigns teams; the write-model keys slots by bracket entry, so map
	// each team to its entry within this match's bracket.
	const db = getBracketsDb(env.BRACKETS);
	const match = await db
		.select({ bracketId: schema.matches.bracketId })
		.from(schema.matches)
		.where(eq(schema.matches.id, id))
		.get();
	if (!match) return new Response("match not found", { status: 404 });
	const entryForTeam = async (teamId: string | null) => {
		if (!teamId) return null;
		const entry = await db
			.select({ id: schema.bracketEntries.id })
			.from(schema.bracketEntries)
			.where(
				and(
					eq(schema.bracketEntries.bracketId, match.bracketId),
					eq(schema.bracketEntries.teamId, teamId),
				),
			)
			.get();
		return entry?.id ?? null;
	};
	const entryAId = await entryForTeam(teamAId);
	const entryBId = await entryForTeam(teamBId);

	const scheduledAt = scheduledAtRaw
		? new Date(scheduledAtRaw).getTime()
		: null;

	await bracketsWrite(env).editMatch({
		matchId: id,
		entryAId,
		entryBId,
		judgeUserId,
		scheduledAt,
		status,
	});

	return redirect(`/admin/matches/${id}`, 303);
};
