import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getBracketsDb } from "@/db/client";
import {
	type ApplicationDecision,
	decideApplication,
} from "@/lib/admin-bracket-commands";

export const prerender = false;

const VALID = ["approved", "rejected"] as const;

function isDecision(v: string): v is ApplicationDecision {
	return (VALID as readonly string[]).includes(v);
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const status = String(form.get("status") ?? "").trim();
	if (!isDecision(status)) {
		return new Response("invalid status", { status: 400 });
	}

	try {
		await decideApplication(getBracketsDb(env.BRACKETS), {
			applicationId: id,
			decision: status,
			reviewedByUserId: locals.user?.id ?? "",
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "could not update application";
		return new Response(message, { status: 400 });
	}

	return redirect("/admin/registrations", 303);
};
