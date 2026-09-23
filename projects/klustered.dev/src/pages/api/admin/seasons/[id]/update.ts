import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";
import { parseOptionalUtcDate } from "@/lib/admin-dates";

export const prerender = false;

const VALID_STATUS = ["interest", "active", "finished"] as const;
type SeasonStatus = (typeof VALID_STATUS)[number];

function isStatus(value: string): value is SeasonStatus {
	return (VALID_STATUS as readonly string[]).includes(value);
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const statusRaw = String(form.get("status") ?? "").trim();
	const patch: { id: string; status?: SeasonStatus; startDate?: number | null; endDate?: number | null } = { id };
	if (statusRaw) {
		if (!isStatus(statusRaw)) return new Response("invalid status", { status: 400 });
		patch.status = statusRaw;
	}

	try {
		if (form.has("startDate")) patch.startDate = parseOptionalUtcDate(String(form.get("startDate") ?? "").trim());
		if (form.has("endDate")) patch.endDate = parseOptionalUtcDate(String(form.get("endDate") ?? "").trim());
	} catch {
		return new Response("invalid season dates", { status: 400 });
	}
	if (
		patch.startDate !== undefined && patch.startDate !== null &&
		patch.endDate !== undefined && patch.endDate !== null &&
		patch.endDate < patch.startDate
	) {
		return new Response("end date must not be before start date", { status: 400 });
	}
	if (patch.status === undefined && patch.startDate === undefined && patch.endDate === undefined) {
		return new Response("no season fields supplied", { status: 400 });
	}

	await bracketsWrite(env).updateSeason(patch);
	return redirect("/admin/seasons", 303);
};
