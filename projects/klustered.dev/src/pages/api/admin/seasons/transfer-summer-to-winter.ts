import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	parseOptionalUtcDate,
	parseOptionalUtcDateTime,
} from "@/lib/admin-dates";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const sourceSeasonId = String(form.get("sourceSeasonId") ?? "").trim();
	const targetSeasonId = String(form.get("targetSeasonId") ?? "").trim();
	const startDateValue = String(form.get("startDate") ?? "").trim();
	const startsAtDate = String(form.get("startsAtDate") ?? startDateValue).trim();
	const startsAtTime = String(form.get("startsAtTime") ?? "").trim();

	let seasonStartDate: number | null;
	let bracketStartsAt: number | null;
	try {
		seasonStartDate = parseOptionalUtcDate(startDateValue);
		bracketStartsAt = parseOptionalUtcDateTime(startsAtDate, startsAtTime);
	} catch {
		return new Response(
			"Enter valid Winter start date and bracket start date/time in UTC",
			{ status: 400 },
		);
	}
	if (
		!sourceSeasonId ||
		!targetSeasonId ||
		seasonStartDate === null ||
		bracketStartsAt === null
	) {
		return new Response(
			"Summer, Winter, and Winter start date/time are required",
			{ status: 400 },
		);
	}

	try {
		const result = await bracketsWrite(env).transferSummerApplicationsToWinter({
			sourceSeasonId,
			targetSeasonId,
			seasonStartDate,
			bracketStartsAt,
		});
		const query = new URLSearchParams({
			applicationsMoved: String(result.applicationsMoved),
			competitorsMoved: String(result.competitorsMoved),
			bracketsActivated: String(result.bracketsActivated),
		});
		return redirect(`/admin/seasons?${query.toString()}`, 303);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Summer to Winter transfer failed";
		return new Response(message, { status: 409 });
	}
};
