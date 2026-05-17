import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export const prerender = false;

const VALID_STATUS = ["scheduled", "live", "completed", "cancelled"] as const;
type Status = (typeof VALID_STATUS)[number];

function isStatus(v: string): v is Status {
	return (VALID_STATUS as readonly string[]).includes(v);
}

function nullable(v: FormDataEntryValue | null): string | null {
	const s = String(v ?? "").trim();
	return s.length === 0 ? null : s;
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const teamAId = nullable(form.get("teamAId"));
	const teamBId = nullable(form.get("teamBId"));
	const scenarioId = nullable(form.get("scenarioId"));
	const judgeUserId = nullable(form.get("judgeUserId"));
	const scheduledAtRaw = nullable(form.get("scheduledAt"));
	const status = String(form.get("status") ?? "").trim();

	if (!isStatus(status)) {
		return new Response("invalid status", { status: 400 });
	}

	const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

	const db = getDb(env.DB);
	await db
		.update(schema.matches)
		.set({
			teamAId,
			teamBId,
			scenarioId,
			judgeUserId,
			scheduledAt,
			status,
		})
		.where(eq(schema.matches.id, id));

	return redirect(`/admin/matches/${id}`, 303);
};
