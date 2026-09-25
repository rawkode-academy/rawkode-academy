import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";
import { parseOptionalUtcDateTime } from "@/lib/admin-dates";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) return new Response("Forbidden", { status: 403 });

	const form = await request.formData();
	const seasonId = String(form.get("seasonId") ?? "").trim();
	const slug = String(form.get("slug") ?? "").trim();
	const name = String(form.get("name") ?? "").trim();
	const kindRaw = String(form.get("kind") ?? "team").trim();
	const kind = kindRaw === "solo" ? "solo" : "team";
	const startsAtRaw = String(form.get("startsAt") ?? "").trim();
	const startsAtDate = String(form.get("startsAtDate") ?? "").trim();
	const startsAtTime = String(form.get("startsAtTime") ?? "19:00").trim();
	const closeDate = String(form.get("registrationClosesAtDate") ?? "").trim();
	const closeTime = String(form.get("registrationClosesAtTime") ?? "").trim();

	let startsAt: number | null = null;
	let registrationClosesAt: number | null = null;
	try {
		startsAt = startsAtRaw
			? Date.parse(startsAtRaw)
			: parseOptionalUtcDateTime(startsAtDate, startsAtTime);
		registrationClosesAt = parseOptionalUtcDateTime(closeDate, closeTime);
	} catch {
		return new Response("invalid bracket date or time", { status: 400 });
	}

	const teamSizeRaw = Number.parseInt(String(form.get("teamSize") ?? "4").trim(), 10);
	const teamSize = Number.isFinite(teamSizeRaw) && teamSizeRaw > 1 ? teamSizeRaw : 4;
	if (!seasonId || !slug || !name || startsAt === null || !Number.isFinite(startsAt)) {
		return new Response("seasonId, slug, name, and start date/time required", { status: 400 });
	}
	if (registrationClosesAt !== null && registrationClosesAt > startsAt) {
		return new Response("registration must close by the bracket start", { status: 400 });
	}

	await bracketsWrite(env).createBracket({
		seasonId,
		slug,
		name,
		kind,
		startsAt,
		registrationClosesAt,
		teamSize,
	});
	return redirect("/admin/brackets", 303);
};
