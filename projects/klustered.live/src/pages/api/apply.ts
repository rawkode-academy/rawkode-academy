import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
	const form = await request.formData();
	const seasonId = String(form.get("seasonId") ?? "").trim();
	const displayName = String(form.get("displayName") ?? "").trim();
	const email = String(form.get("email") ?? "").trim();
	const message = String(form.get("message") ?? "").trim() || null;

	if (!seasonId || !displayName || !email) {
		return new Response("seasonId, displayName, email required", { status: 400 });
	}

	const db = getDb(env.DB);
	await db.insert(schema.registrations).values({
		id: `reg-${crypto.randomUUID()}`,
		seasonId,
		userId: null,
		displayName,
		email,
		message,
		submittedAt: new Date(),
	});

	return redirect("/apply?submitted=1", 303);
};
