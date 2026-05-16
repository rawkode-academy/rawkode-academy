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
	const slug = String(form.get("slug") ?? "").trim();
	const name = String(form.get("name") ?? "").trim();

	if (!seasonId || !slug || !name) {
		return new Response("seasonId, slug, name required", { status: 400 });
	}

	const db = getDb(env.DB);
	await db.insert(schema.brackets).values({
		id: `brk-${crypto.randomUUID()}`,
		seasonId,
		slug,
		name,
	});

	return redirect("/admin/brackets", 303);
};
