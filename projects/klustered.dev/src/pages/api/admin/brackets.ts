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
	const slug = String(form.get("slug") ?? "").trim();
	const name = String(form.get("name") ?? "").trim();
	const kindRaw = String(form.get("kind") ?? "team").trim();
	const kind = kindRaw === "solo" ? "solo" : "team";
	const teamSizeRaw = Number.parseInt(
		String(form.get("teamSize") ?? "2").trim(),
		10,
	);
	const teamSize = Number.isFinite(teamSizeRaw) && teamSizeRaw > 1 ? teamSizeRaw : 2;

	if (!seasonId || !slug || !name) {
		return new Response("seasonId, slug, name required", { status: 400 });
	}

	await bracketsWrite(env).createBracket({ seasonId, slug, name, kind, teamSize });

	return redirect("/admin/brackets", 303);
};
