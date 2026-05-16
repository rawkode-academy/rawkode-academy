import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const seasonId = String(form.get("seasonId") ?? "").trim();
	const personSlug = String(form.get("personSlug") ?? "").trim();
	const displayName = String(form.get("displayName") ?? "").trim();

	if (!seasonId || !personSlug || !displayName) {
		return new Response("seasonId, personSlug, displayName required", {
			status: 400,
		});
	}

	const db = getDb(env.DB);
	await db.insert(schema.competitors).values({
		id: `cmp-${crypto.randomUUID()}`,
		seasonId,
		personSlug,
		displayName,
	});

	return redirect("/admin/competitors", 303);
};
