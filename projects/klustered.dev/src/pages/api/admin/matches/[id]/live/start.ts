import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const now = new Date();
	const db = getDb(env.DB);

	await db
		.update(schema.matches)
		.set({ status: "live", startedAt: now })
		.where(eq(schema.matches.id, id));

	return redirect(`/admin/matches/${id}/live`, 303);
};
