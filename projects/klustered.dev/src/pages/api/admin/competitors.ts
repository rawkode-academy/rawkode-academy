import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const seasonId = String(form.get("seasonId") ?? "").trim();
	const personSlug = String(form.get("personSlug") ?? "").trim();
	const displayName = String(form.get("displayName") ?? "").trim();
	const userId = String(form.get("userId") ?? "").trim() || null;

	if (!seasonId || !personSlug || !displayName) {
		return new Response("seasonId, personSlug, displayName required", {
			status: 400,
		});
	}

	await bracketsWrite(env).createCompetitor({
		seasonId,
		personSlug,
		displayName,
		userId,
	});

	return redirect("/admin/competitors", 303);
};
