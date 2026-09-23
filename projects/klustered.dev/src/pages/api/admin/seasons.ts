import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite, SHOW_ID } from "@/lib/brackets-write";
import { parseOptionalUtcDate } from "@/lib/admin-dates";

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
	if (!slug || !name) return new Response("slug and name are required", { status: 400 });
	if (!isStatus(status)) return new Response("invalid status", { status: 400 });

	let startDate: number | null;
	let endDate: number | null;
	try {
		startDate = parseOptionalUtcDate(String(form.get("startDate") ?? "").trim());
		endDate = parseOptionalUtcDate(String(form.get("endDate") ?? "").trim());
	} catch {
		return new Response("invalid season dates", { status: 400 });
	}
	if (startDate !== null && endDate !== null && endDate < startDate) {
		return new Response("end date must not be before start date", { status: 400 });
	}

	await bracketsWrite(env).createSeason({ showId: SHOW_ID, slug, name, status, startDate, endDate });
	return redirect("/admin/seasons", 303);
};
