import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getBracketsDb, schema } from "@/db/client";
import { bracketsWrite } from "@/lib/brackets-write";
import { matchEditCommand } from "@/lib/match-admin";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const db = getBracketsDb(env.BRACKETS);
	const match = await db
		.select({ bracketId: schema.matches.bracketId })
		.from(schema.matches)
		.where(eq(schema.matches.id, id))
		.get();
	if (!match) return new Response("match not found", { status: 404 });

	const bracket = await db
		.select({ kind: schema.brackets.kind })
		.from(schema.brackets)
		.where(eq(schema.brackets.id, match.bracketId))
		.get();
	if (!bracket) return new Response("bracket not found", { status: 404 });

	const entries = await db
		.select({
			id: schema.bracketEntries.id,
			teamId: schema.bracketEntries.teamId,
		})
		.from(schema.bracketEntries)
		.where(eq(schema.bracketEntries.bracketId, match.bracketId))
		.all();

	const edited = matchEditCommand({ kind: bracket.kind, form, entries });
	if (!edited.ok) {
		return new Response(edited.message, { status: edited.status });
	}

	await bracketsWrite(env).editMatch({
		matchId: id,
		...edited.command,
	});

	return redirect(`/admin/matches/${id}`, 303);
};
