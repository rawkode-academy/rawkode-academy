import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getBracketsDb } from "@/db/client";
import { createBracketEntry } from "@/lib/admin-bracket-commands";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const bracketId = params.id;
	if (!bracketId) return new Response("missing bracket id", { status: 400 });

	const form = await request.formData();
	const competitorId = String(form.get("competitorId") ?? "").trim() || null;
	const teamId = String(form.get("teamId") ?? "").trim() || null;
	const seedRaw = Number.parseInt(String(form.get("seed") ?? "").trim(), 10);
	const seed = Number.isFinite(seedRaw) && seedRaw > 0 ? seedRaw : null;

	try {
		await createBracketEntry(getBracketsDb(env.BRACKETS), {
			bracketId,
			competitorId,
			teamId,
			seed,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "could not create entry";
		return new Response(message, { status: 400 });
	}

	return redirect(`/admin/brackets/${bracketId}`, 303);
};
