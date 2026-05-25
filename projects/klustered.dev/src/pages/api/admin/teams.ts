import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const bracketId = String(form.get("bracketId") ?? "").trim();
	const slug = String(form.get("slug") ?? "").trim();
	const name = String(form.get("name") ?? "").trim();

	if (!bracketId || !slug || !name) {
		return new Response("bracketId, slug, name required", { status: 400 });
	}

	await bracketsWrite(env).createTeam({ bracketId, slug, name });

	return redirect("/admin/teams", 303);
};
