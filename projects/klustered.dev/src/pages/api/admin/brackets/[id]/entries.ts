import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

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

	await bracketsWrite(env).createBracketEntry({
		bracketId,
		competitorId,
		teamId,
		seed,
	});

	return redirect(`/admin/brackets/${bracketId}`, 303);
};
