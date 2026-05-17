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

	const db = getDb(env.DB);
	await db.delete(schema.seasons).where(eq(schema.seasons.id, id));

	return redirect("/admin/seasons", 303);
};
