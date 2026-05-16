import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb, schema } from "@/db/client";

export const prerender = false;

const VALID_STATUS = ["interest", "active", "finished"] as const;
type Status = (typeof VALID_STATUS)[number];

function isStatus(value: string): value is Status {
	return (VALID_STATUS as readonly string[]).includes(value);
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const slug = String(form.get("slug") ?? "").trim();
	const name = String(form.get("name") ?? "").trim();
	const status = String(form.get("status") ?? "interest").trim();

	if (!slug || !name) {
		return new Response("slug and name are required", { status: 400 });
	}
	if (!isStatus(status)) {
		return new Response("invalid status", { status: 400 });
	}

	const db = getDb(env.DB);
	await db.insert(schema.seasons).values({
		id: `ssn-${crypto.randomUUID()}`,
		slug,
		name,
		status,
	});

	return redirect("/admin/seasons", 303);
};
